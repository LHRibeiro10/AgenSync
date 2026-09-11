import { money } from "../utils.js";

export const DEFAULT_REMINDER_MESSAGE =
  "Olá, {cliente}! Passando para lembrar do seu atendimento de {servico} no dia {data} às {hora}.";

export const DEFAULT_CONFIRMATION_MESSAGE =
  "Olá, {cliente}! Tudo certo para o seu atendimento de {servico} no dia {data} às {hora}? Pode me confirmar por aqui, por favor?";

export const DEFAULT_CANCELLATION_MESSAGE =
  "Ola, {cliente}! Precisamos cancelar seu atendimento de {servico} que estava agendado para {data} as {hora}. Se quiser, podemos combinar um novo horario por aqui.";

export const WHATSAPP_VARIABLES = ["{cliente}", "{servico}", "{data}", "{hora}", "{negocio}", "{profissional}", "{valor}"];

export function resolveClientWhatsAppPhone(client) {
  if (!client || typeof client !== "object") return "";
  return client.phone || client.responsavel?.phone || client.responsavelTelefone || "";
}

export function normalizeWhatsAppPhone(phone) {
  const raw = String(phone || "").trim();
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "");

  if (!digits) {
    return {
      digits: "",
      valid: false,
      error: "Este cliente não possui telefone cadastrado."
    };
  }

  const normalized = digits.startsWith("55") ? digits : digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  const isBrazilian = /^55\d{10,11}$/.test(normalized);
  const isInternational = /^\d{10,15}$/.test(normalized);

  if (!isBrazilian && !isInternational) {
    return {
      digits: normalized,
      valid: false,
      error: "Telefone inválido. Revise o número do cliente antes de abrir o WhatsApp."
    };
  }

  return { digits: normalized, valid: true, error: "" };
}

export function formatAppointmentDate(dateValue) {
  const [year, month, day] = String(dateValue || "").split("-");
  if (!year || !month || !day) return String(dateValue || "");
  return `${day}/${month}/${year}`;
}

export function appointmentTemplateVariables({ appointment, user }) {
  return {
    cliente: appointment?.client?.name || appointment?.client || "cliente",
    servico: appointment?.service?.name || appointment?.service || "atendimento",
    data: formatAppointmentDate(appointment?.date),
    hora: appointment?.startTime || "",
    negocio: user?.businessName || "nosso espaço",
    profissional: appointment?.professional?.name || user?.name || "profissional",
    valor: money(appointment?.price || 0)
  };
}

export function renderAppointmentMessage({ appointment, user, template }) {
  const variables = appointmentTemplateVariables({ appointment, user });
  return String(template || DEFAULT_CONFIRMATION_MESSAGE).replace(/\{(\w+)\}/g, (match, key) => {
    return variables[key] ?? match;
  });
}

export function buildAppointmentWhatsAppUrl(phone, message) {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized.valid) return "";
  return `https://wa.me/${normalized.digits}?text=${encodeURIComponent(message)}`;
}

export function copyWithFallback(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!copied) {
    return Promise.reject(new Error("Não foi possível copiar a mensagem."));
  }

  return Promise.resolve();
}
