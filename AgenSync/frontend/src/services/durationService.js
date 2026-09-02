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
