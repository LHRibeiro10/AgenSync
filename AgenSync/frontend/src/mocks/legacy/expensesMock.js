const EXPENSES_KEY = "agensync_local_expenses_v1";

export const expenseCategories = [
  { value: "materiais", label: "Materiais" },
  { value: "produtos", label: "Produtos" },
  { value: "aluguel", label: "Aluguel" },
  { value: "transporte", label: "Transporte" },
  { value: "contas", label: "Contas" },
  { value: "marketing", label: "Marketing" },
  { value: "outros", label: "Outros" }
];

const pad = (value) => String(value).padStart(2, "0");

function formatInputDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseInputDate(value) {
  return new Date(`${value}T00:00:00`);
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfMonth(value) {
  const date = parseInputDate(value);
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function nextMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function occurrenceDateForMonth(startDate, monthDate) {
  const start = parseInputDate(startDate);
  const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const day = Math.min(start.getDate(), lastDay);
  return `${monthDate.getFullYear()}-${pad(monthDate.getMonth() + 1)}-${pad(day)}`;
}

function id() {
  if (window.crypto?.randomUUID) return `expense_${window.crypto.randomUUID()}`;
  return `expense_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function seedExpenses() {
  const now = new Date();
  const today = formatInputDate(now);
  const yesterday = formatInputDate(addDays(now, -1));
  const threeDaysAgo = formatInputDate(addDays(now, -3));
  const eightDaysAgo = formatInputDate(addDays(now, -8));
  const createdAt = new Date().toISOString();

  return [
    {
      id: "expense_today_materials",
      description: "Reposicao de materiais descartaveis",
      category: "materiais",
      amount: 38,
      date: today,
      notes: "Luvas, lixas e algodao.",
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "expense_today_transport",
      description: "Transporte para atendimento externo",
      category: "transporte",
      amount: 24,
      date: today,
      notes: "",
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "expense_yesterday_products",
      description: "Compra de produtos para estoque",
      category: "produtos",
      amount: 145,
      date: yesterday,
      notes: "Reposicao de produtos mais usados.",
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "expense_three_days_marketing",
      description: "Impulsionamento no Instagram",
      category: "marketing",
      amount: 60,
      date: threeDaysAgo,
      notes: "Campanha de horarios livres.",
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "expense_eight_days_bills",
      description: "Conta de internet",
      category: "contas",
      amount: 99,
      date: eightDaysAgo,
      notes: "",
      createdAt,
      updatedAt: createdAt
    }
  ];
}

function readExpenses() {
  const raw = localStorage.getItem(EXPENSES_KEY);
  if (!raw) {
    const seeded = seedExpenses();
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error("invalid");
    return data;
  } catch {
    const seeded = seedExpenses();
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function writeExpenses(expenses) {
  localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
}

function publicExpense(expense) {
  const recurrence = expense.recurrence === "monthly" ? "monthly" : "once";

  return {
    ...expense,
    amount: Number(expense.amount || 0),
    notes: expense.notes || "",
    recurrence,
    sourceId: expense.sourceId || expense.id
  };
}

function recurringOccurrences(expense, filters = {}) {
  const startDate = filters.startDate || expense.date;
  const endDate = filters.endDate || formatInputDate(new Date());
  if (!expense.date || endDate < expense.date || endDate < startDate) return [];

  const occurrences = [];
  let cursor = startOfMonth(startDate < expense.date ? expense.date : startDate);
  const endMonth = startOfMonth(endDate);

  while (cursor <= endMonth) {
    const occurrenceDate = occurrenceDateForMonth(expense.date, cursor);
    if (occurrenceDate >= expense.date && occurrenceDate >= startDate && occurrenceDate <= endDate) {
      occurrences.push(
        publicExpense({
          ...expense,
          id: `${expense.id}_${occurrenceDate.slice(0, 7)}`,
          sourceId: expense.id,
          date: occurrenceDate,
          originalDate: expense.date,
          isRecurringOccurrence: true
        })
      );
    }
    cursor = nextMonth(cursor);
  }

  return occurrences;
}

function validateExpense(payload) {
  if (!String(payload.description || "").trim()) throw new Error("Descricao e obrigatoria.");
  if (!String(payload.category || "").trim()) throw new Error("Categoria e obrigatoria.");
  if (!String(payload.date || "").trim()) throw new Error("Data e obrigatoria.");

  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Valor da despesa deve ser maior que zero.");
  }
}

export function expenseCategoryLabel(value) {
  return expenseCategories.find((category) => category.value === value)?.label || value;
}

export function listExpenses(filters = {}) {
  return readExpenses()
    .flatMap((expense) =>
      expense.recurrence === "monthly" ? recurringOccurrences(expense, filters) : [publicExpense(expense)]
    )
    .filter((expense) => !filters.startDate || expense.date >= filters.startDate)
    .filter((expense) => !filters.endDate || expense.date <= filters.endDate)
    .filter((expense) => !filters.category || expense.category === filters.category)
    .filter((expense) => {
      const search = String(filters.search || "").trim().toLowerCase();
      if (!search) return true;
      return [expense.description, expense.notes, expenseCategoryLabel(expense.category)]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(search));
    })
    .sort((first, second) => `${second.date}${second.createdAt}`.localeCompare(`${first.date}${first.createdAt}`));
}

export function createExpense(payload) {
  validateExpense(payload);
  const now = new Date().toISOString();
  const expenses = readExpenses();
  const expense = {
    id: id(),
    description: payload.description.trim(),
    category: payload.category,
    amount: Number(payload.amount),
    date: payload.date,
    recurrence: payload.recurrence === "monthly" ? "monthly" : "once",
    notes: String(payload.notes || "").trim(),
    createdAt: now,
    updatedAt: now
  };
  expenses.push(expense);
  writeExpenses(expenses);
  return publicExpense(expense);
}

export function updateExpense(expenseId, payload) {
  validateExpense(payload);
  const expenses = readExpenses();
  const expense = expenses.find((item) => item.id === expenseId);
  if (!expense) throw new Error("Despesa nao encontrada.");

  expense.description = payload.description.trim();
  expense.category = payload.category;
  expense.amount = Number(payload.amount);
  expense.date = payload.date;
  expense.recurrence = payload.recurrence === "monthly" ? "monthly" : "once";
  expense.notes = String(payload.notes || "").trim();
  expense.updatedAt = new Date().toISOString();

  writeExpenses(expenses);
  return publicExpense(expense);
}

export function deleteExpense(expenseId) {
  const expenses = readExpenses();
  writeExpenses(expenses.filter((expense) => expense.id !== expenseId));
}

export function sumExpenses(expenses) {
  return expenses.reduce((total, expense) => total + Number(expense.amount || 0), 0);
}
