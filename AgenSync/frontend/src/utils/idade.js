const AGE_TIMEZONE = "America/Sao_Paulo";

export function todayInTimeZone(timeZone = AGE_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  return new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
}

export function calcularIdade(dataNascimento, referenceDate = todayInTimeZone()) {
  if (!dataNascimento) return null;

  let birth = dataNascimento;
  if (!(birth instanceof Date)) {
    const text = String(dataNascimento).trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
    birth = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(text);
  }
  if (Number.isNaN(birth.getTime())) return null;

  let age = referenceDate.getFullYear() - birth.getFullYear();
  const birthdayNotYetHappenedThisYear =
    referenceDate.getMonth() < birth.getMonth() ||
    (referenceDate.getMonth() === birth.getMonth() && referenceDate.getDate() < birth.getDate());
  if (birthdayNotYetHappenedThisYear) age -= 1;

  return age;
}
