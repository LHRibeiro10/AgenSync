const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric"
});

export function formatReminderDate(value) {
  if (!value) return "";
  return dateFormatter.format(new Date(`${value}T00:00:00`));
}

export function buildReminderMessage(appointment) {
  const clientName = appointment?.client?.name || "tudo bem";
  const date = formatReminderDate(appointment?.date);
  const time = appointment?.startTime || "";
  const service = appointment?.service?.name || "seu atendimento";

  return `Oi, ${clientName}! Passando para lembrar do seu horário no dia ${date} às ${time} para ${service}. Qualquer imprevisto, me avise.`;
}

export function normalizeWhatsappPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function buildWhatsappUrl(phone, message) {
  const normalized = normalizeWhatsappPhone(phone);
  if (!normalized) return "";
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
