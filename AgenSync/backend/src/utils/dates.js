const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

const pad = (value) => String(value).padStart(2, "0");

export function todayString() {
  return formatDate(new Date());
}

export function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseDateOnly(value, fieldName = "data") {
  if (!value || !DATE_PATTERN.test(value)) {
    throw new Error(`${fieldName} deve estar no formato AAAA-MM-DD.`);
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    throw new Error(`${fieldName} inválida.`);
  }

  return parsed;
}

export function parseTimeOnly(value) {
  if (!value || !TIME_PATTERN.test(value)) {
    throw new Error("hora inicial deve estar no formato HH:mm.");
  }

  const [hours, minutes] = value.split(":").map(Number);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error("hora inicial inválida.");
  }

  return { hours, minutes };
}

export function combineDateAndTime(dateValue, timeValue) {
  const date = parseDateOnly(dateValue);
  const { hours, minutes } = parseTimeOnly(timeValue);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

export function endOfDay(date) {
  const value = startOfDay(date);
  value.setDate(value.getDate() + 1);
  return value;
}

export function startOfWeek(date) {
  const value = startOfDay(date);
  const day = value.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  value.setDate(value.getDate() + diff);
  return value;
}

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

export function dateRangeFromQuery(query) {
  const where = {};

  if (query.date) {
    const date = parseDateOnly(query.date);
    where.gte = startOfDay(date);
    where.lt = endOfDay(date);
    return where;
  }

  if (query.startDate) {
    where.gte = startOfDay(parseDateOnly(query.startDate, "data inicial"));
  }

  if (query.endDate) {
    where.lt = endOfDay(parseDateOnly(query.endDate, "data final"));
  }

  return Object.keys(where).length ? where : null;
}
