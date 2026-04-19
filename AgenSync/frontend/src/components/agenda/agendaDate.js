const shortWeekdays = ["DOM.", "SEG.", "TER.", "QUA.", "QUI.", "SEX.", "SÁB."];
const longWeekdays = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const shortMonths = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
const longMonths = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro"
];

export function parseDateKey(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDateKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function startOfWeek(date) {
  const current = new Date(date);
  const weekday = current.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  current.setDate(current.getDate() + diff);
  current.setHours(0, 0, 0, 0);
  return current;
}

export function buildWeekDays(weekStart, workingHours) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const weekday = date.getDay();
    const dateKey = formatDateKey(date);
    const hours = workingHours[weekday];

    return {
      date: dateKey,
      weekday,
      shortLabel: shortWeekdays[weekday],
      dayNumber: String(date.getDate()),
      monthLabel: `${date.getDate()} de ${shortMonths[date.getMonth()]}`,
      longLabel: `${longWeekdays[weekday]}, ${date.getDate()} de ${longMonths[date.getMonth()]} de ${date.getFullYear()}`,
      isClosed: !hours?.enabled,
      workingHours: hours
    };
  });
}

export function formatWeekLabel(days) {
  const first = parseDateKey(days[0].date);
  const last = parseDateKey(days[days.length - 1].date);
  const sameMonth = first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear();

  if (sameMonth) {
    return `${first.getDate()} - ${last.getDate()} de ${longMonths[first.getMonth()]} de ${first.getFullYear()}`;
  }

  return `${first.getDate()} de ${shortMonths[first.getMonth()]} - ${last.getDate()} de ${shortMonths[last.getMonth()]} de ${last.getFullYear()}`;
}

export const weekdayOptions = shortWeekdays.map((shortLabel, weekday) => ({
  weekday,
  shortLabel,
  label: longWeekdays[weekday]
}));
