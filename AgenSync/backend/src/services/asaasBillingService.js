import crypto from "crypto";
import { getPlanConfig, normalizePlanSlug } from "../config/plans.js";
import { ApiError } from "../middleware/error.js";
import { prisma } from "../prisma.js";
import { normalizeEnvValue } from "../utils/env.js";
import { asaasRequest, getAsaasConfig } from "./asaasClient.js";

function optionalString(value, maxLength = 500) {
  const text = String(value || "").trim();
  return text ? text.slice(0, maxLength) : null;
}

function formatDateOnly(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return date.toISOString().slice(0, 10);
}

function addMonths(date, amount) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
}

function rawBodyText(req) {
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  if (typeof req.body === "string") return req.body;
  return JSON.stringify(req.body || {});
}

function parseJson(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(400, "Payload de webhook Asaas invalido.");
  }
}

function timingSafeEqualText(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function workspaceExternalReference(workspaceId, plan) {
  return `agensync:${workspaceId}:${normalizePlanSlug(plan)}:${Date.now()}`;
}

function invoiceStatusFromAsaas(eventType, payment = {}) {
  if (eventType === "PAYMENT_RECEIVED") return "PAID";
  if (eventType === "PAYMENT_OVERDUE") return "OVERDUE";
  if (eventType === "PAYMENT_DELETED" || eventType === "PAYMENT_RESTORED") return "CANCELED";
  if (eventType === "PAYMENT_REFUNDED") return "REFUNDED";
  if (String(payment.status || "").toUpperCase() === "RECEIVED") return "PAID";
  if (String(payment.status || "").toUpperCase() === "OVERDUE") return "OVERDUE";
  return "OPEN";
}

function paidAtFromAsaas(eventType, payment = {}) {
  if (eventType !== "PAYMENT_RECEIVED" && String(payment.status || "").toUpperCase() !== "RECEIVED") return null;
  return payment.paymentDate || payment.clientPaymentDate || payment.confirmedDate || new Date().toISOString();
}

function findCheckoutUrl(payment = {}, subscription = {}) {
  return (
    optionalString(payment.invoiceUrl, 1000) ||
    optionalString(payment.bankSlipUrl, 1000) ||
    optionalString(payment.transactionReceiptUrl, 1000) ||
    optionalString(subscription.invoiceUrl, 1000) ||
    ""
  );
}

export async function ensureAsaasBillingCustomer(workspaceId) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          businessName: true,
          businessPhone: true
        }
      },
      billingCustomer: true
    }
  });
  if (!workspace) throw new ApiError(404, "Workspace nao encontrado.");

  const existing = workspace.billingCustomer;
  if (existing?.provider === "ASAAS" && existing.providerCustomerId) return existing;

  const name = optionalString(workspace.name || workspace.owner?.businessName || workspace.owner?.name, 240);
  const email = optionalString(workspace.owner?.email, 240);
  const phone = optionalString(workspace.owner?.businessPhone, 32);

  const customerPayload = await asaasRequest("/customers", {
    method: "POST",
    body: {
      name,
      email,
      ...(phone ? { phone, mobilePhone: phone } : {}),
      externalReference: workspace.id
    }
  });

  return prisma.billingCustomer.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      provider: "ASAAS",
      providerCustomerId: customerPayload.id,
      email,
      name,
      metadata: { asaas: customerPayload }
    },
    update: {
      provider: "ASAAS",
      providerCustomerId: customerPayload.id,
      email,
      name,
      metadata: { asaas: customerPayload }
    }
  });
}

async function firstSubscriptionPayment(providerSubscriptionId) {
  if (!providerSubscriptionId) return null;
  const response = await asaasRequest(`/subscriptions/${encodeURIComponent(providerSubscriptionId)}/payments?limit=1`);
  const payments = Array.isArray(response?.data) ? response.data : [];
  return payments[0] || null;
}

export async function createAsaasBillingCheckout(workspaceId, options = {}) {
  const plan = normalizePlanSlug(options.plan || options.planSlug || "padrao");
  const planConfig = getPlanConfig(plan);
  const customer = await ensureAsaasBillingCustomer(workspaceId);
  const nextDueDate = formatDateOnly(new Date());
  const externalReference = workspaceExternalReference(workspaceId, plan);
  const config = getAsaasConfig();

  const subscriptionPayload = {
    customer: customer.providerCustomerId,
    billingType: "UNDEFINED",
    value: Number(planConfig.price),
    nextDueDate,
    cycle: "MONTHLY",
    description: `Assinatura AgenSync - ${planConfig.displayName}`,
    externalReference,
    ...(options.successUrl || options.cancelUrl
      ? {
          callback: {
            successUrl: optionalString(options.successUrl, 1000) || undefined,
            autoRedirect: true
          }
        }
      : {})
  };

  const subscription = await asaasRequest("/subscriptions", {
    method: "POST",
    body: subscriptionPayload
  });
  const firstPayment = await firstSubscriptionPayment(subscription.id).catch(() => null);
  const checkoutUrl = findCheckoutUrl(firstPayment || {}, subscription);

  const localSubscription = await prisma.billingSubscription.upsert({
    where: { provider_providerSubscriptionId: { provider: "ASAAS", providerSubscriptionId: subscription.id } },
    create: {
      workspaceId,
      billingCustomerId: customer.id,
      provider: "ASAAS",
      providerSubscriptionId: subscription.id,
      providerPriceId: plan,
      plan,
      status: "PAST_DUE",
      currentPeriodStart: new Date(),
      currentPeriodEnd: addMonths(new Date(), 1),
      metadata: { asaas: subscription, externalReference, env: config.env }
    },
    update: {
      billingCustomerId: customer.id,
      providerPriceId: plan,
      plan,
      status: "PAST_DUE",
      metadata: { asaas: subscription, externalReference, env: config.env }
    }
  });

  const providerInvoiceId = optionalString(firstPayment?.id || subscription.id, 180);
  const invoice = await prisma.billingInvoice.upsert({
    where: { provider_providerInvoiceId: { provider: "ASAAS", providerInvoiceId } },
    create: {
      workspaceId,
      billingSubscriptionId: localSubscription.id,
      provider: "ASAAS",
      providerInvoiceId,
      providerPaymentId: optionalString(firstPayment?.id, 180),
      providerCheckoutSessionId: subscription.id,
      amount: Number(planConfig.price),
      currency: "BRL",
      status: invoiceStatusFromAsaas("PAYMENT_CREATED", firstPayment || {}),
      dueAt: firstPayment?.dueDate ? new Date(firstPayment.dueDate) : new Date(),
      hostedUrl: checkoutUrl || null,
      pdfUrl: optionalString(firstPayment?.bankSlipUrl, 1000),
      metadata: { asaas: firstPayment || subscription, externalReference, plan }
    },
    update: {
      billingSubscriptionId: localSubscription.id,
      providerPaymentId: optionalString(firstPayment?.id, 180),
      providerCheckoutSessionId: subscription.id,
      amount: Number(planConfig.price),
      status: invoiceStatusFromAsaas("PAYMENT_CREATED", firstPayment || {}),
      dueAt: firstPayment?.dueDate ? new Date(firstPayment.dueDate) : new Date(),
      hostedUrl: checkoutUrl || null,
      pdfUrl: optionalString(firstPayment?.bankSlipUrl, 1000),
      metadata: { asaas: firstPayment || subscription, externalReference, plan }
    }
  });

  if (!checkoutUrl) {
    throw new ApiError(502, "Assinatura criada no Asaas, mas a URL de pagamento ainda nao foi retornada. Tente abrir a fatura novamente em alguns segundos.");
  }

  return {
    provider: "asaas",
    checkoutUrl,
    url: checkoutUrl,
    invoiceUrl: checkoutUrl,
    providerSubscriptionId: subscription.id,
    providerInvoiceId,
    subscriptionId: localSubscription.id,
    invoiceId: invoice.id
  };
}

export async function createAsaasPortalSession(workspaceId) {
  const invoice = await prisma.billingInvoice.findFirst({
    where: { workspaceId, provider: "ASAAS", status: { in: ["OPEN", "OVERDUE"] } },
    orderBy: [{ createdAt: "desc" }]
  });

  if (!invoice?.hostedUrl) {
    throw new ApiError(404, "Nenhuma fatura Asaas aberta encontrada para este workspace.");
  }

  return {
    provider: "asaas",
    portalUrl: invoice.hostedUrl,
    url: invoice.hostedUrl,
    message: "O Asaas nao possui portal equivalente ao Stripe nesta integracao; abrimos a fatura atual."
  };
}

export function verifyAsaasWebhook(req) {
  const configuredToken = getAsaasConfig().webhookToken;
  if (configuredToken) {
    const receivedToken = normalizeEnvValue(req.get("asaas-access-token") || "");
    if (!receivedToken || !timingSafeEqualText(receivedToken, configuredToken)) {
      throw new ApiError(401, "Webhook Asaas nao autorizado.");
    }
  } else if (process.env.NODE_ENV === "production") {
    throw new ApiError(500, "ASAAS_WEBHOOK_TOKEN nao configurado.");
  }

  const payload = parseJson(rawBodyText(req));
  const eventType = optionalString(payload.event || payload.type, 180) || "ASAAS_EVENT";
  const payment = payload.payment && typeof payload.payment === "object" ? payload.payment : {};
  const eventId =
    optionalString(payload.id, 180) ||
    optionalString(`${eventType}:${payment.id || "no_payment"}:${payment.status || ""}:${payment.dateCreated || payment.confirmedDate || payment.paymentDate || ""}`, 180);
  const providerSubscriptionId = optionalString(payment.subscription, 180);
  const providerPaymentId = optionalString(payment.id, 180);
  const plan = optionalString(payment.externalReference, 500)?.split(":")[2] || "";

  return {
    id: eventId,
    type: eventType,
    data: {
      workspaceId: "",
      providerSubscriptionId,
      subscriptionId: providerSubscriptionId,
      providerInvoiceId: providerPaymentId,
      invoiceId: providerPaymentId,
      providerPaymentId,
      paymentId: providerPaymentId,
      amount: payment.value || payment.netValue || 0,
      status: invoiceStatusFromAsaas(eventType, payment),
      invoiceStatus: invoiceStatusFromAsaas(eventType, payment),
      dueAt: payment.dueDate,
      paidAt: paidAtFromAsaas(eventType, payment),
      hostedUrl: payment.invoiceUrl,
      pdfUrl: payment.bankSlipUrl,
      plan,
      metadata: { asaas: payment, event: eventType }
    },
    payload
  };
}
