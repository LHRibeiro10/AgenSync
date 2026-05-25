import { addMinutes, combineDateAndTime, formatDate, parseDateOnly } from "../utils/dates.js";

const MAX_OCCURRENCES = 180;
const WEEKDAY_MIN = 0;
const WEEKDAY_MAX = 6;

const pad = (value) => String(value).padStart(2, "0");

function toDateOnly(value, fieldName = "data") {
  if (value instanceof Date) return parseDateOnly(formatDate(value), fieldName);
  return parseDateOnly(String(value || "").slice(0, 10), fieldName);
}

function dateKey(value) {
  return formatDate(value instanceof Date ? value : toDateOnly(value));
}

function monthKey(value) {
  return dateKey(value).slice(0, 7);
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, date.getDate());
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function clampDay(year, monthIndex, day) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return Math.max(1, Math.min(Number(day || 1), lastDay));
}

function normalizeWeekdays(value) {
  const source = Array.isArray(value) ? value : [];
  return [...new Set(source.map(Number).filter((day) => day >= WEEKDAY_MIN && day <= WEEKDAY_MAX))].sort(
    (first, second) => first - second
  );
}

function normalizeManualDates(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || "").slice(0, 10)).filter(Boolean))].sort();
}

export function normalizeRecurrenceConfig({ recurrenceType, recurrenceConfig, startDate }) {
  const start = toDateOnly(startDate, "data de inicio");
  const incoming = recurrenceConfig && typeof recurrenceConfig === "object" ? recurrenceConfig : {};
  const config = {};

  if (recurrenceType === "WEEKLY" || recurrenceType === "WEEKDAYS") {
    const weekdays = normalizeWeekdays(incoming.weekdays);
    config.weekdays = weekdays.length ? weekdays : [start.getDay()];
  }

  if (recurrenceType === "MONTHLY") {
    config.monthDay = clampDay(start.getFullYear(), start.getMonth(), incoming.monthDay || start.getDate());
  }

  if (recurrenceType === "EVERY_X_DAYS") {
    const intervalDays = Number(incoming.intervalDays || 2);
    config.intervalDays = Number.isInteger(intervalDays) && intervalDays > 0 ? Math.min(intervalDays, 365) : 2;
  }

  if (recurrenceType === "MANUAL_DATES") {
    config.manualDates = normalizeManualDates(incoming.manualDates);
  }

  return config;
}

function pushIfAllowed({ occurrences, monthCounts, sessionsPerMonth, date, startTime, durationMinutes, rangeStart, rangeEnd }) {
  if (date < rangeStart || date > rangeEnd) return;
  const month = monthKey(date);
  const used = monthCounts.get(month) || 0;
  if (used >= sessionsPerMonth) return;

  const startsAt = combineDateAndTime(dateKey(date), startTime);
  const endsAt = addMinutes(startsAt, durationMinutes);

  occurrences.push({
    date: dateKey(date),
    startTime,
    startsAt,
    endsAt,
    month
  });
  monthCounts.set(month, used + 1);
}

export function buildMonthlyPlanOccurrences(plan, options = {}) {
  const startDate = toDateOnly(options.startDate || plan.startDate, "data inicial");
  const planStart = toDateOnly(plan.startDate, "data de inicio");
  const rangeStart = startDate < planStart ? planStart : startDate;
  const planEnd = plan.endDate ? toDateOnly(plan.endDate, "data final") : null;
  const fallbackEnd = addMonths(rangeStart, Number(options.months || 2));
  const requestedEnd = options.endDate ? toDateOnly(options.endDate, "data final") : fallbackEnd;
  const rangeEnd = planEnd && planEnd < requestedEnd ? planEnd : requestedEnd;
  const startTime = plan.defaultStartTime || options.startTime || "09:00";
  const durationMinutes = Number(plan.durationMinutes || plan.service?.durationMinutes || options.durationMinutes || 60);
  const sessionsPerMonth = Math.max(1, Number(plan.sessionsPerMonth || 1));
  const recurrenceType = plan.recurrenceType || "MONTHLY";
  const config = normalizeRecurrenceConfig({
    recurrenceType,
    recurrenceConfig: plan.recurrenceConfig || {},
    startDate: plan.startDate
  });
  const occurrences = [];
  const monthCounts = new Map();

  if (rangeEnd < rangeStart) return [];

  if (recurrenceType === "MANUAL_DATES") {
    config.manualDates.forEach((manualDate) => {
      pushIfAllowed({
        occurrences,
        monthCounts,
        sessionsPerMonth,
        date: toDateOnly(manualDate),
        startTime,
        durationMinutes,
        rangeStart,
        rangeEnd
      });
    });
    return occurrences.slice(0, MAX_OCCURRENCES);
  }

  if (recurrenceType === "MONTHLY") {
    let cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
    while (cursor <= rangeEnd && occurrences.length < MAX_OCCURRENCES) {
      const date = new Date(cursor.getFullYear(), cursor.getMonth(), clampDay(cursor.getFullYear(), cursor.getMonth(), config.monthDay));
      pushIfAllowed({ occurrences, monthCounts, sessionsPerMonth, date, startTime, durationMinutes, rangeStart, rangeEnd });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return occurrences;
  }

  if (recurrenceType === "BIWEEKLY" || recurrenceType === "EVERY_X_DAYS") {
    const intervalDays = recurrenceType === "BIWEEKLY" ? 14 : config.intervalDays;
    let cursor = planStart;
    while (cursor < rangeStart) cursor = addDays(cursor, intervalDays);
    while (cursor <= rangeEnd && occurrences.length < MAX_OCCURRENCES) {
      pushIfAllowed({ occurrences, monthCounts, sessionsPerMonth, date: cursor, startTime, durationMinutes, rangeStart, rangeEnd });
      cursor = addDays(cursor, intervalDays);
    }
    return occurrences;
  }

  const weekdays = recurrenceType === "WEEKLY" || recurrenceType === "WEEKDAYS" ? config.weekdays : [planStart.getDay()];
  let cursor = rangeStart;
  while (cursor <= rangeEnd && occurrences.length < MAX_OCCURRENCES) {
    if (weekdays.includes(cursor.getDay())) {
      pushIfAllowed({ occurrences, monthCounts, sessionsPerMonth, date: cursor, startTime, durationMinutes, rangeStart, rangeEnd });
    }
    cursor = addDays(cursor, 1);
  }

  return occurrences;
}

export function generationEndDateFromMonths(startDate, months = 1) {
  const start = toDateOnly(startDate);
  const endMonth = addMonths(start, Math.max(1, Number(months || 1)) - 1);
  return `${endMonth.getFullYear()}-${pad(endMonth.getMonth() + 1)}-${pad(endOfMonth(endMonth).getDate())}`;
}
