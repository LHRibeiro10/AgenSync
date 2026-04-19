import { money } from "../utils.js";

export function whatsappPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function buildBudgetWhatsAppMessage({ client, budget }) {
  const lines = [`Oi, ${client.name}! Segue seu orçamento:`, ""];

  if (budget.services?.length) {
    lines.push("Serviços:");
    budget.services.forEach((service) => {
      lines.push(`- ${service.name}: ${money(service.price)}`);
    });
    lines.push("");
  }

  if (budget.products?.length) {
    lines.push("Produtos:");
    budget.products.forEach((product) => {
      lines.push(`- ${product.name} (${product.quantity} un.): ${money(product.total)}`);
    });
    lines.push("");
  }

  lines.push(`Total: ${money(budget.total)}`);

  if (budget.notes) {
    lines.push("", `Observações: ${budget.notes}`);
  }

  lines.push("", "Qualquer dúvida, me chama.");

  return lines.join("\n");
}

export function buildWhatsAppUrl(phone, message) {
  const digits = whatsappPhone(phone);
  if (!digits) return "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
