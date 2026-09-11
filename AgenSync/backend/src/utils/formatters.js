import { calcularIdade, formatDate, formatTime } from "./dates.js";
import { normalizePlanSlug, publicPlan } from "../config/plans.js";

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
  const currentWorkspace = user.currentWorkspace || null;
  const workspaceMember = user.workspaceMember || null;
  const plan = publicPlan(currentWorkspace ? { platformPlan: currentWorkspace.plan } : user);
  const workspaceRole = workspaceMember?.role || String(user.workspaceRole || "OWNER").toLowerCase();
  const professionalId = workspaceMember?.professionalId || user.professionalId || "";
  const exceededResources = Array.isArray(currentWorkspace?.exceededResources) ? currentWorkspace.exceededResources : [];

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: String(user.role || "USER").toLowerCase(),
    workspaceRole: String(workspaceRole || "owner").toLowerCase(),
    platformRole: user.platformRole ? String(user.platformRole).toLowerCase() : "",
    platformPlan: plan.slug,
    plan: plan.slug,
    planLimits: {
      maxUsers: plan.maxUsers,
      maxProfessionals: plan.maxProfessionals,
      maxAdmins: plan.maxAdmins
    },
    planFeatures: plan.features,
    accountStatus: String(user.accountStatus || "ACTIVE").toLowerCase(),
    userStatus: String(user.userStatus || "ACTIVE").toLowerCase(),
    subscriptionStatus: String(user.subscriptionStatus || "PAID").toLowerCase(),
    subscriptionPaidUntil: user.subscriptionPaidUntil || null,
    temporaryAccessUntil: user.temporaryAccessUntil || null,
    billingEnabled: Boolean(user.billingEnabled),
    currentWorkspaceId: currentWorkspace?.id || user.currentWorkspaceId || "",
    currentWorkspace,
    workspaceMember,
    permissions: workspaceMember?.permissions || {},
    planLimitExceeded: Boolean(currentWorkspace?.planLimitExceeded || exceededResources.length),
    exceededResources,
    businessName: user.businessName,
    businessLogo: user.businessLogo || "",
    businessType: user.businessType,
    businessTypeCustom: user.businessTypeCustom || "",
    businessPhone: user.businessPhone || "",
    businessCity: user.businessCity || "",
    businessAddress: user.businessAddress || "",
    onboardingCompleted: user.onboardingCompleted === true,
    onboardingCompletedAt: user.onboardingCompletedAt || null,
    professionalId,
    whatsappReminderEnabled: Boolean(user.whatsappReminderEnabled),
    whatsappReminderOffsetMinutes: Number(user.whatsappReminderOffsetMinutes || 120),
    whatsappReminderMessage: user.whatsappReminderMessage || "",
    whatsappReminderTestPhone: user.whatsappReminderTestPhone || "",
    whatsappConfirmationMessage: user.whatsappConfirmationMessage || "",
    appointmentNotificationsEnabled: user.appointmentNotificationsEnabled !== false,
    appointmentNotificationOffsetMinutes: Number(user.appointmentNotificationOffsetMinutes || 30),
    appointmentNotificationChannels: Array.isArray(user.appointmentNotificationChannels)
      ? user.appointmentNotificationChannels
      : ["internal", "push"],
    createdAt: user.createdAt
  };
}

export function publicClient(client) {
  const responsavel = client.responsavel
    ? { id: client.responsavel.id, name: client.responsavel.name, phone: client.responsavel.phone || "" }
    : null;
  const dependentes = Array.isArray(client.dependentes)
    ? client.dependentes.map((dependente) => ({
        id: dependente.id,
        name: dependente.name,
        birthDate: dependente.birthDate ? formatDate(dependente.birthDate) : "",
        idade: dependente.birthDate ? calcularIdade(dependente.birthDate) : null
      }))
    : undefined;

  return {
    id: client.id,
    name: client.name,
    phone: client.phone || "",
    email: client.email || "",
    cpf: client.cpf || "",
    cnpj: client.cnpj || "",
    rg: client.rg || "",
    birthDate: client.birthDate ? formatDate(client.birthDate) : "",
    idade: client.birthDate ? calcularIdade(client.birthDate) : null,
    sexo: client.sexo || "",
    contatoEmergenciaNome: client.contatoEmergenciaNome || "",
    contatoEmergenciaTelefone: client.contatoEmergenciaTelefone || "",
    contatoEmergenciaParentesco: client.contatoEmergenciaParentesco || "",
    responsavelId: client.responsavelId || "",
    responsavel,
    responsavelParentesco: client.responsavelParentesco || "",
    responsavelNome: responsavel ? responsavel.name : client.responsavelNome || "",
    responsavelTelefone: responsavel ? responsavel.phone || "" : client.responsavelTelefone || "",
    dependentes,
    zipCode: client.zipCode || "",
    address: client.address || "",
    addressNumber: client.addressNumber || "",
    addressComplement: client.addressComplement || "",
    district: client.district || "",
    state: client.state || "",
    city: client.city || "",
    tags: client.tags || "",
    source: client.source || "",
    externalId: client.externalId || "",
    notes: client.notes || "",
    photoUrl: client.photoUrl || "",
    internalPreferences: client.internalPreferences || "",
    isActive: client.isActive !== false,
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
  const accessMember = Array.isArray(professional.workspaceMembers)
    ? professional.workspaceMembers.find((member) => member.status !== "DISABLED") ||
      professional.workspaceMembers.find((member) => member.userId) ||
      null
    : null;
  const stats = professional.stats && typeof professional.stats === "object" ? professional.stats : null;

  return {
    id: professional.id,
    name: professional.name,
    role: professional.role || "",
    email: professional.email || "",
    phone: professional.phone || "",
    monthlyGoal: professional.monthlyGoal === null || professional.monthlyGoal === undefined ? null : Number(professional.monthlyGoal),
    isActive: professional.isActive,
    access: accessMember
      ? {
          memberId: accessMember.id,
          userId: accessMember.userId,
          name: accessMember.user?.name || "",
          email: accessMember.user?.email || "",
          role: String(accessMember.role || "PROFESSIONAL").toLowerCase(),
          status: String(accessMember.status || "ACTIVE").toLowerCase(),
          permissions: accessMember.permissions && typeof accessMember.permissions === "object" ? accessMember.permissions : {}
        }
      : null,
    stats: stats
      ? {
          total: Number(stats.total || 0),
          completed: Number(stats.completed || 0),
          revenue: Number(stats.revenue || 0)
        }
      : undefined,
    createdAt: professional.createdAt,
    updatedAt: professional.updatedAt
  };
}

export function publicAppointment(appointment) {
  const durationMinutes =
    appointment.durationMinutes || minutesBetween(appointment.startsAt, appointment.endsAt);

  return {
    id: appointment.id,
    kind: String(appointment.kind || "APPOINTMENT").toLowerCase(),
    title: appointment.title || "",
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
    monthlyPlanId: appointment.monthlyPlanId || "",
    monthlyPlan: appointment.monthlyPlan
      ? {
          id: appointment.monthlyPlan.id,
          planName: appointment.monthlyPlan.planName,
          billingType: String(appointment.monthlyPlan.billingType || "FIXED_MONTHLY").toLowerCase(),
          status:
            appointment.monthlyPlan.status === "CANCELED"
              ? "canceled"
              : appointment.monthlyPlan.status === "PAUSED"
                ? "paused"
                : "active"
        }
      : null,
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
    brand: product.brand || "",
    supplierName: product.supplierName || "",
    supplierContact: product.supplierContact || "",
    sku: product.sku || "",
    unit: product.unit || "unidade",
    expirationDate: product.expirationDate ? formatDate(product.expirationDate) : "",
    usageType: product.usageType || "revenda",
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  };
}

export function publicProductVariant(variant) {
  return {
    id: variant.id,
    productId: variant.productId,
    label: variant.label,
    sku: variant.sku || "",
    costPrice: Number(variant.costPrice),
    salePrice: Number(variant.salePrice),
    stockQty: variant.stockQty,
    isActive: variant.isActive
  };
}

export function publicProductStockMovement(movement) {
  return {
    id: movement.id,
    productId: movement.productId,
    variantId: movement.variantId || "",
    type: movement.type,
    quantity: movement.quantity,
    supplierName: movement.supplierName || "",
    note: movement.note || "",
    createdAt: movement.createdAt
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
  const appointments = Array.isArray(plan.appointments) ? plan.appointments : [];
  return {
    id: plan.id,
    clientId: plan.clientId,
    clientName: plan.client?.name || "Cliente",
    serviceId: plan.serviceId || "",
    serviceName: plan.service?.name || "",
    professionalId: plan.professionalId || "",
    professionalName: plan.professional?.name || "",
    planName: plan.planName,
    amount: Number(plan.amount),
    dueDay: plan.dueDay,
    startDate: formatDate(plan.startDate),
    endDate: plan.endDate ? formatDate(plan.endDate) : "",
    billingType: String(plan.billingType || "FIXED_MONTHLY").toLowerCase(),
    priceMode: String(plan.priceMode || "MONTHLY_PRICE").toLowerCase(),
    monthlyPrice: plan.monthlyPrice === null || plan.monthlyPrice === undefined ? null : Number(plan.monthlyPrice),
    sessionPrice: plan.sessionPrice === null || plan.sessionPrice === undefined ? null : Number(plan.sessionPrice),
    sessionsPerMonth: Number(plan.sessionsPerMonth || 1),
    recurrenceType: String(plan.recurrenceType || "MONTHLY").toLowerCase(),
    recurrenceConfig: plan.recurrenceConfig || {},
    defaultStartTime: plan.defaultStartTime || "",
    durationMinutes: plan.durationMinutes || plan.service?.durationMinutes || null,
    generateAppointments: Boolean(plan.generateAppointments),
    generatedUntil: plan.generatedUntil ? formatDate(plan.generatedUntil) : "",
    status: plan.status === "CANCELED" ? "canceled" : plan.status === "PAUSED" ? "paused" : "active",
    pausedAt: plan.pausedAt ? formatDate(plan.pausedAt) : "",
    canceledAt: plan.canceledAt ? formatDate(plan.canceledAt) : "",
    notes: plan.notes || "",
    payments: payments.map((payment) => ({
      id: payment.id || `${plan.id}_${payment.month}`,
      month: payment.month,
      status:
        payment.status === "PAID"
          ? "paid"
          : payment.status === "OVERDUE"
            ? "overdue"
            : payment.status === "CANCELED"
              ? "canceled"
              : "pending",
      dueDate: payment.dueDate ? formatDate(payment.dueDate) : "",
      paidAt: payment.paidAt ? formatDate(payment.paidAt) : "",
      amount: Number(payment.amount),
      paymentMethod: payment.paymentMethod || "",
      notes: payment.notes || "",
      manual: payment.manual
    })),
    appointments: appointments.map(publicAppointment),
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt
  };
}
