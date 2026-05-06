import { money } from "../utils.js";

export const DEFAULT_WHATSAPP_REMINDER_MESSAGE =
  "Ola, {cliente}! Voce tem um atendimento de {servico} com {negocio} no dia {data} as {hora}. Qualquer imprevisto, responda por aqui.";

export const whatsappReminderVariables = [
  "{cliente}",
  "{servico}",
  "{negocio}",
  "{profissional}",
  "{data}",
  "{hora}",
  "{horaFinal}",
  "{valor}",
  "{endereco}"
];

export const whatsappReminderOffsets = [
  { value: 30, label: "30 minutos" },
  { value: 60, label: "1 hora" },
  { value: 120, label: "2 horas" },
  { value: 240, label: "4 horas" },
  { value: 1440, label: "1 dia antes" }
];

export const whatsappReminderExample = {
  cliente: "Maria",
  servico: "Consulta",
  negocio: "AgenSync",
  profissional: "Luiz",
  data: "06/05",
  hora: "18:00",
  horaFinal: "19:00",
  valor: "R$ 120,00",
  endereco: "Rua Exemplo, 123"
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit"
});

export function formatReminderDate(value) {
  if (!value) return "";
  return dateFormatter.format(new Date(`${value}T00:00:00`));
}

export function reminderSettingsFromUser(user) {
  return {
    enabled: Boolean(user?.whatsappReminderEnabled),
    offsetMinutes: Number(user?.whatsappReminderOffsetMinutes || 120),
    message: user?.whatsappReminderMessage || DEFAULT_WHATSAPP_REMINDER_MESSAGE,
    testPhone: user?.whatsappReminderTestPhone || ""
  };
}

export function buildReminderVariablesFromAppointment(appointment, user) {
  return {
    cliente: appointment?.client?.name || "Cliente",
    servico: appointment?.service?.name || "atendimento",
    negocio: user?.businessName || "AgenSync",
    profissional: appointment?.professional?.name || user?.name || "Profissional",
    data: formatReminderDate(appointment?.date),
    hora: appointment?.startTime || "",
    horaFinal: appointment?.endTime || "",
    valor: money(appointment?.price || 0),
    endereco: user?.businessAddress || ""
  };
}

export function renderReminderMessage(template, variables = {}) {
  const source = template || DEFAULT_WHATSAPP_REMINDER_MESSAGE;
  return source.replace(/\{(cliente|servico|negocio|profissional|data|hora|horaFinal|valor|endereco)\}/g, (_, key) => {
    return variables[key] || "";
  });
}

export function buildReminderMessage(appointment, user) {
  const settings = reminderSettingsFromUser(user);
  return renderReminderMessage(settings.message, buildReminderVariablesFromAppointment(appointment, user));
}

export function normalizeWhatsappPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function isValidWhatsappPhone(phone) {
  const normalized = normalizeWhatsappPhone(phone);
  return /^55\d{10,11}$/.test(normalized);
}

export function buildWhatsappUrl(phone, message) {
  const normalized = normalizeWhatsappPhone(phone);
  if (!normalized) return "";
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
