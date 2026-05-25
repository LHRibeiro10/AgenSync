import { Router } from "express";
import { prisma } from "../prisma.js";
import { ApiError, asyncHandler } from "../middleware/error.js";
import { requireWorkspaceManager } from "../utils/accessControl.js";
import { formatDate, parseDateOnly, startOfDay } from "../utils/dates.js";
import { publicExpense } from "../utils/formatters.js";
import { optionalString, parsePagination, parsePositiveMoney, requiredString } from "../utils/validation.js";

const router = Router();

router.use((req, res, next) => {
  requireWorkspaceManager(req);
  next();
});

function nextMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function startOfMonth(value) {
  const date = parseDateOnly(value);
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthKey(date) {
  return formatDate(date).slice(0, 7);
}

function occurrenceDateForMonth(startDate, monthDate) {
  const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const day = Math.min(startDate.getDate(), lastDay);
  return new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
}

function expenseWhere(userId, query) {
  const where = { userId };
  if (query.category) where.category = String(query.category);
  if (query.search) {
    const search = String(query.search).trim();
    where.OR = [
      { description: { contains: search, mode: "insensitive" } },
      { notes: { contains: search, mode: "insensitive" } },
      { category: { contains: search, mode: "insensitive" } }
    ];
  }
  return where;
}

function expandRecurring(expense, startDate, endDate) {
  if (expense.recurrence !== "MONTHLY") return [publicExpense(expense)];
  if (formatDate(endDate) < formatDate(expense.date)) return [];

  const start = startOfMonth(formatDate(startDate < expense.date ? expense.date : startDate));
  const end = startOfMonth(formatDate(endDate));
  const items = [];
  let cursor = start;

  while (cursor <= end) {
    const occurrence = occurrenceDateForMonth(expense.date, cursor);
    if (occurrence >= expense.date && occurrence >= startDate && occurrence <= endDate) {
      items.push({
        ...publicExpense({ ...expense, date: occurrence }),
        id: `${expense.id}_${monthKey(occurrence)}`,
        sourceId: expense.id,
        originalDate: formatDate(expense.date),
        isRecurringOccurrence: true
      });
    }
    cursor = nextMonth(cursor);
  }

  return items;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query, {
      defaultPageSize: 120,
      maxPageSize: 300
    });
    const startDate = startOfDay(parseDateOnly(req.query.startDate || formatDate(new Date()), "data inicial"));
    const endDate = startOfDay(parseDateOnly(req.query.endDate || formatDate(new Date()), "data final"));
    const expenses = await prisma.expense.findMany({
      where: {
        ...expenseWhere(req.user.id, req.query),
        OR: [
          { recurrence: "MONTHLY", date: { lte: endDate } },
          { recurrence: "ONCE", date: { gte: startDate, lte: endDate } }
        ]
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }]
    });

    const normalizedExpenses = expenses
      .flatMap((expense) => expandRecurring(expense, startDate, endDate))
      .sort((first, second) => `${second.date}${second.createdAt}`.localeCompare(`${first.date}${first.createdAt}`));

    const pagedExpenses = pagination.enabled
      ? normalizedExpenses.slice(pagination.skip, pagination.skip + pagination.take)
      : normalizedExpenses;

    res.json({
      expenses: pagedExpenses
    });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const expense = await prisma.expense.create({
      data: {
        workspaceId: req.workspaceId || null,
        userId: req.user.id,
        description: requiredString(req.body.description, "descrição", 2),
        category: requiredString(req.body.category, "categoria"),
        amount: parsePositiveMoney(req.body.amount, "valor"),
        date: parseDateOnly(requiredString(req.body.date, "data")),
        recurrence: req.body.recurrence === "monthly" ? "MONTHLY" : "ONCE",
        notes: optionalString(req.body.notes)
      }
    });

    res.status(201).json({ expense: publicExpense(expense) });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const exists = await prisma.expense.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!exists) throw new ApiError(404, "Despesa não encontrada.");

    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data: {
        description: requiredString(req.body.description, "descrição", 2),
        category: requiredString(req.body.category, "categoria"),
        amount: parsePositiveMoney(req.body.amount, "valor"),
        date: parseDateOnly(requiredString(req.body.date, "data")),
        recurrence: req.body.recurrence === "monthly" ? "MONTHLY" : "ONCE",
        notes: optionalString(req.body.notes)
      }
    });

    res.json({ expense: publicExpense(expense) });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const exists = await prisma.expense.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!exists) throw new ApiError(404, "Despesa não encontrada.");
    await prisma.expense.delete({ where: { id: req.params.id } });
    res.status(204).send();
  })
);

export default router;
