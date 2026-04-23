import { formatDate, formatTime } from "./dates.js";

function minutesBetween(start, end) {
  if (!start || !end) return 0;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
}

export const statusToDb = {
  agendado: "SCHEDULED",
  concluido: "COMPLETED",
  "concluído": "COMPLETED",
  cancelado: "CANCELED",
  nao_compareceu: "NO_SHOW",
  "não_compareceu": "NO_SHOW",
  "nao compareceu": "NO_SHOW",
  "não compareceu": "NO_SHOW"
};

export const dbToStatus = {
  SCHEDULED: "agendado",
  COMPLETED: "concluido",
  CANCELED: "cancelado",
  NO_SHOW: "nao_compareceu"
};

export function normalizeStatus(value, fallback = null) {
  if (!value) return fallback;
  const normalized = String(value).trim().toLowerCase();
  const status = statusToDb[normalized];
  if (!status) {
    throw new Error("status inválido.");
  }
  return status;
}

export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: String(user.role || "USER").toLowerCase(),
    businessName: user.businessName,
    businessLogo: user.businessLogo || "",
    businessType: user.businessType,
    createdAt: user.createdAt
  };
}

export function publicClient(client) {
  return {
    id: client.id,
    name: client.name,
    phone: client.phone,
    notes: client.notes || "",
    createdAt: client.createdAt,
    updatedAt: client.updatedAt
  };
}

export function publicClientCareRecord(record) {
  return {
    anamnesis: record?.anamnesis || null,
    documents: Array.isArray(record?.documents) ? record.documents : [],
    budgets: Array.isArray(record?.budgets) ? record.budgets : [],
    forms: Array.isArray(record?.forms) ? record.forms : [],
    photos: Array.isArray(record?.photos) ? record.photos : [],
    evolutions: Array.isArray(record?.evolutions) ? record.evolutions : []
  };
}

export function publicService(service) {
  return {
    id: service.id,
    name: service.name,
    priceDefault: Number(service.priceDefault),
    durationMinutes: service.durationMinutes,
    isActive: service.isActive,
    createdAt: service.createdAt,
    updatedAt: service.updatedAt
  };
}

export function publicProfessional(professional) {
  return {
    id: professional.id,
    name: professional.name,
    role: professional.role || "",
    phone: professional.phone || "",
    isActive: professional.isActive,
    createdAt: professional.createdAt,
    updatedAt: professional.updatedAt
  };
}

export function publicAppointment(appointment) {
  const durationMinutes =
    appointment.durationMinutes || minutesBetween(appointment.startsAt, appointment.endsAt);

  return {
    id: appointment.id,
    clientId: appointment.clientId,
    serviceId: appointment.serviceId,
    professionalId: appointment.professionalId || "",
    date: formatDate(appointment.startsAt),
    startTime: formatTime(appointment.startsAt),
    endTime: formatTime(appointment.endsAt),
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    durationMinutes,
    price: Number(appointment.price),
    notes: appointment.notes || "",
    status: dbToStatus[appointment.status],
    client: appointment.client ? publicClient(appointment.client) : undefined,
    service: appointment.service ? publicService(appointment.service) : undefined,
    professional: appointment.professional ? publicProfessional(appointment.professional) : undefined,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt
  };
}

export function publicExpense(expense) {
  return {
    id: expense.id,
    sourceId: expense.id,
    description: expense.description,
    category: expense.category,
    amount: Number(expense.amount),
    date: formatDate(expense.date),
    recurrence: expense.recurrence === "MONTHLY" ? "monthly" : "once",
    notes: expense.notes || "",
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt
  };
}

export function publicProduct(product) {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    costPrice: Number(product.costPrice),
    salePrice: Number(product.salePrice),
    stockQty: product.stockQty,
    minStock: product.minStock,
    description: product.description || "",
    isActive: product.isActive,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  };
}

export function publicProductSale(sale) {
  return {
    id: sale.id,
    productId: sale.productId,
    productName: sale.productName,
    unitPrice: Number(sale.unitPrice),
    unitCost: Number(sale.unitCost),
    quantity: sale.quantity,
    total: Number(sale.total),
    date: formatDate(sale.date),
    clientId: sale.clientId || "",
    clientName: sale.client?.name || "",
    notes: sale.notes || "",
    createdAt: sale.createdAt
  };
}

export function publicMonthlyPlan(plan) {
  const payments = Array.isArray(plan.payments) ? plan.payments : [];
  return {
    id: plan.id,
    clientId: plan.clientId,
    clientName: plan.client?.name || "Cliente",
    planName: plan.planName,
    amount: Number(plan.amount),
    dueDay: plan.dueDay,
    startDate: formatDate(plan.startDate),
    status: plan.status === "CANCELED" ? "canceled" : "active",
    canceledAt: plan.canceledAt ? formatDate(plan.canceledAt) : "",
    notes: plan.notes || "",
    payments: payments.map((payment) => ({
      month: payment.month,
      status: payment.status === "PAID" ? "paid" : "pending",
      paidAt: payment.paidAt ? formatDate(payment.paidAt) : "",
      amount: Number(payment.amount),
      manual: payment.manual
    })),
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt
  };
}
