export const durationUnits = [
  { value: "minutes", label: "Minutos" },
  { value: "hours", label: "Horas" },
  { value: "day", label: "Dia" }
];

export function durationToMinutes(value, unit) {
  const amount = Number(value);
  if (unit === "day") return 24 * 60;
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (unit === "hours") return Math.round(amount * 60);
  return Math.round(amount);
}

export function minutesToDurationInput(minutes) {
  const safeMinutes = Number(minutes) || 0;
  if (safeMinutes === 24 * 60) {
    return { durationValue: 1, durationUnit: "day" };
  }
  if (safeMinutes >= 60 && safeMinutes % 60 === 0) {
    return { durationValue: safeMinutes / 60, durationUnit: "hours" };
  }
  return { durationValue: safeMinutes || 60, durationUnit: "minutes" };
}

export function durationLabel(minutes) {
  const safeMinutes = Number(minutes) || 0;
  if (safeMinutes === 24 * 60) return "Dia todo";
  if (safeMinutes >= 60 && safeMinutes % 60 === 0) {
    const hours = safeMinutes / 60;
    return `${hours} ${hours === 1 ? "hora" : "horas"}`;
  }
  if (safeMinutes >= 60) {
    const hours = Math.floor(safeMinutes / 60);
    const remainingMinutes = safeMinutes % 60;
    return `${hours}h ${remainingMinutes}min`;
  }
  return `${safeMinutes} min`;
}
