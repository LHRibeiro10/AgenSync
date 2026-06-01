import crypto from "crypto";
import { PLAN_SLUGS, getPlanConfig, normalizePlanSlug } from "../config/plans.js";
import { invalidateAuthUserCache } from "../middleware/auth.js";
import { ApiError } from "../middleware/error.js";
import { prisma } from "../prisma.js";
import { normalizeEnvValue } from "../utils/env.js";

const billingProviders = new Set(["MANUAL", "STRIPE", "MERCADO_PAGO", "ASAAS"]);
const subscriptionStatuses = new Set(["PAID", "TRIAL", "PAST_DUE", "CANCELED"]);
const invoiceStatuses = new Set(["DRAFT", "OPEN", "PAID", "VOID", "UNCOLLECTIBLE", "CANCELED"]);

function upper(value, fallback = "") {
  const normalized = String(value || "").trim().toUpperCase().replace(/-/g, "_");
  return normalized || fallback;
}

export function normalizeBillingProvider(value) {
  const provider = upper(value || process.env.BILLING_PROVIDER || "MANUAL", "MANUAL");
  return billingProviders.has(provider) ? provider : "MANUAL";
}

function normalizeSubscriptionStatus(value, fallback = "TRIAL") {
  const status = upper(value, fallback);
  return subscriptionStatuses.has(status) ? status : fallback;
}

function normalizeInvoiceStatus(value, fallback = "OPEN") {
  const status = upper(value, fallback);
  return invoiceStatuses.has(status) ? status : fallback;
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const timestamp = value < 100000000000 ? value * 1000 : value;
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function optionalString(value, maxLength = 500) {
  const text = String(value || "").trim();
  return text ? text.slice(0, maxLength) : null;
}

function publicBillingCustomer(customer) {
  if (!customer) return null;
  return {
    id: customer.id,
    workspaceId: customer.workspaceId,
    provider: String(customer.provider || "MANUAL").toLowerCase(),
    providerCustomerId: customer.providerCustomerId || "",
    email: customer.email || "",
    name: customer.name || "",
    metadata: customer.metadata || {},
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt
  };
}

function publicBillingSubscription(subscription) {
  if (!subscription) return null;
  return {
    id: subscription.id,
    workspaceId: subscription.workspaceId,
    billingCustomerId: subscription.billingCustomerId || "",
    provider: String(subscription.provider || "MANUAL").toLowerCase(),
    providerSubscriptionId: subscription.providerSubscriptionId || "",
    providerPriceId: subscription.providerPriceId || "",
    plan: normalizePlanSlug(subscription.plan),
    status: String(subscription.status || "TRIAL").toLowerCase(),
    currentPeriodStart: subscription.currentPeriodStart || null,
    currentPeriodEnd: subscription.currentPeriodEnd || null,
    trialEndsAt: subscription.trialEndsAt || null,
    cancelAtPeriodEnd: Boolean(subscription.cancelAtPeriodEnd),
    canceledAt: subscription.canceledAt || null,
    metadata: subscription.metadata || {},
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt
  };
}

function publicBillingInvoice(invoice) {
  if (!invoice) return null;
  return {
    id: invoice.id,
    workspaceId: invoice.workspaceId,
    billingSubscriptionId: invoice.billingSubscriptionId || "",
    provider: String(invoice.provider || "MANUAL").toLowerCase(),
    providerInvoiceId: invoice.providerInvoiceId || "",
    providerPaymentId: invoice.providerPaymentId || "",
    providerCheckoutSessionId: invoice.providerCheckoutSessionId || "",
    amount: Number(invoice.amount || 0),
    currency: invoice.currency || "BRL",
    status: String(invoice.status || "OPEN").toLowerCase(),
    dueAt: invoice.dueAt || null,
    paidAt: invoice.paidAt || null,
    hostedUrl: invoice.hostedUrl || "",
    pdfUrl: invoice.pdfUrl || "",
    metadata: invoice.metadata || {},
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt
  };
}

function publicBillingWebhookEvent(event) {
  if (!event) return null;
  return {
    id: event.id,
    workspaceId: event.workspaceId || "",
    provider: String(event.provider || "MANUAL").toLowerCase(),
    eventId: event.eventId,
    eventType: event.eventType,
    status: String(event.status || "RECEIVED").toLowerCase(),
    errorMessage: event.errorMessage || "",
    receivedAt: event.receivedAt,
    processedAt: event.processedAt || null
  };
}

function billingPriceEnvKey(plan) {
  return `BILLING_PRICE_${normalizePlanSlug(plan).toUpperCase()}`;
}

function priceIdForPlan(plan) {
  const normalizedPlan = normalizePlanSlug(plan);
  return normalizeEnvValue(process.env[billingPriceEnvKey(normalizedPlan)] || "");
}

function defaultReturnUrl(path) {
  const baseUrl = normalizeEnvValue(process.env.APP_URL || process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "");
  if (!baseUrl || baseUrl.includes(",")) return "";
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

function secretFromRequest(req) {
  const authHeader = String(req.get("authorization") || "");
  if (authHeader.startsWith("Bearer ")) return authHeader.slice("Bearer ".length).trim();
  return String(req.get("x-billing-webhook-secret") || req.get("x-agensync-webhook-secret") || "").trim();
}

function timingSafeEqualText(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function rawBodyText(req) {
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  if (typeof req.body === "string") return req.body;
  return JSON.stringify(req.body || {});
}

function parseJsonPayload(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(400, "Payload de webhook invalido.");
  }
}

function verifyManualWebhook(req) {
  const configuredSecret = normalizeEnvValue(process.env.BILLING_WEBHOOK_SECRET || "");
  if (configuredSecret) {
    const receivedSecret = secretFromRequest(req);
    if (!receivedSecret || !timingSafeEqualText(receivedSecret, configuredSecret)) {
      throw new ApiError(401, "Webhook de billing nao autorizado.");
    }
  } else if (process.env.NODE_ENV === "production") {
    throw new ApiError(500, "BILLING_WEBHOOK_SECRET nao configurado.");
  }

  const payload = parseJsonPayload(rawBodyText(req));
  const eventId = optionalString(payload.id || payload.eventId || payload.externalId, 180) || `manual_${Date.now()}`;
  const eventType = optionalString(payload.type || payload.eventType, 180) || "billing.event";
  return {
    id: eventId,
    type: eventType,
    data: payload.data && typeof payload.data === "object" ? payload.data : payload,
    payload
  };
}

export function verifyBillingWebhook(providerValue, req) {
  const provider = normalizeBillingProvider(providerValue);
  if (provider === "MANUAL") return verifyManualWebhook(req);

  throw new ApiError(
    501,
    `Provider ${provider.toLowerCase()} ainda nao esta configurado. Instale o SDK/validador de assinatura antes de ativar webhooks reais.`
  );
}

async function invalidateWorkspaceAuthCache(workspaceId) {
  if (!workspaceId) return;
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      ownerId: true,
      members: { select: { userId: true } }
    }
  });
  if (!workspace) return;

  [workspace.ownerId, ...workspace.members.map((member) => member.userId)]
    .filter(Boolean)
    .forEach((userId) => invalidateAuthUserCache(userId));
}

async function syncWorkspaceBillingState({ workspaceId, plan, status, currentPeriodEnd, trialEndsAt, billingEnabled = true }) {
  if (!workspaceId) return;
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { ownerId: true, plan: true, planStatus: true }
  });
  if (!workspace) return;

  const nextPlan = plan ? normalizePlanSlug(plan) : normalizePlanSlug(workspace.plan);
  const nextStatus = normalizeSubscriptionStatus(status, workspace.planStatus || "TRIAL");
  const paidUntil = currentPeriodEnd || trialEndsAt || null;

  await prisma.$transaction([
    prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        plan: nextPlan,
        planStatus: nextStatus,
        ...(trialEndsAt !== undefined ? { trialEndsAt } : {})
      }
    }),
    prisma.user.update({
      where: { id: workspace.ownerId },
      data: {
        platformPlan: nextPlan,
        subscriptionStatus: nextStatus,
        subscriptionPaidUntil: paidUntil,
        billingEnabled
      }
    })
  ]);

  await invalidateWorkspaceAuthCache(workspaceId);
}

export async function ensureBillingCustomer(workspaceId, options = {}) {
  const provider = normalizeBillingProvider(options.provider);
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      name: true,
      owner: { select: { id: true, name: true, email: true } }
    }
  });
  if (!workspace) throw new ApiError(404, "Workspace nao encontrado.");

  const email = optionalString(options.email || workspace.owner?.email, 240);
  const name = optionalString(options.name || workspace.name || workspace.owner?.name, 240);

  return prisma.billingCustomer.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      provider,
      providerCustomerId: optionalString(options.providerCustomerId, 180),
      email,
      name,
      metadata: options.metadata || {}
    },
    update: {
      provider,
      ...(options.providerCustomerId !== undefined ? { providerCustomerId: optionalString(options.providerCustomerId, 180) } : {}),
      email,
      name,
      metadata: options.metadata || {}
    }
  });
}

export async function getBillingStatus(workspaceId) {
  const [workspace, customer, subscription, invoices] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        plan: true,
        planStatus: true,
        trialStartedAt: true,
        trialEndsAt: true,
        owner: {
          select: {
            id: true,
            email: true,
            subscriptionPaidUntil: true,
            billingEnabled: true
          }
        }
      }
    }),
    prisma.billingCustomer.findUnique({ where: { workspaceId } }),
    prisma.billingSubscription.findFirst({
      where: { workspaceId },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
    }),
    prisma.billingInvoice.findMany({
      where: { workspaceId },
      orderBy: [{ createdAt: "desc" }],
      take: 12
    })
  ]);

  if (!workspace) throw new ApiError(404, "Workspace nao encontrado.");
  const plan = getPlanConfig(workspace.plan);

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      plan: normalizePlanSlug(workspace.plan),
      planStatus: String(workspace.planStatus || "PAID").toLowerCase(),
      planPrice: plan.price,
      trialStartedAt: workspace.trialStartedAt || null,
      trialEndsAt: workspace.trialEndsAt || null,
      subscriptionPaidUntil: workspace.owner?.subscriptionPaidUntil || null,
      billingEnabled: Boolean(workspace.owner?.billingEnabled)
    },
    customer: publicBillingCustomer(customer),
    subscription: publicBillingSubscription(subscription),
    invoices: invoices.map(publicBillingInvoice),
    provider: String(normalizeBillingProvider()).toLowerCase(),
    checkoutEnabled: normalizeBillingProvider() !== "MANUAL"
  };
}

export async function createBillingCheckoutSession(workspaceId, options = {}) {
  const provider = normalizeBillingProvider();
  const plan = normalizePlanSlug(options.plan || PLAN_SLUGS.PADRAO);
  const priceId = priceIdForPlan(plan);
  const customer = await ensureBillingCustomer(workspaceId, { provider });

  if (provider === "MANUAL") {
    throw new ApiError(501, "Gateway de pagamento ainda nao configurado. Billing interno preparado para integracao.");
  }

  if (!priceId) {
    throw new ApiError(500, `Configure ${billingPriceEnvKey(plan)} para criar checkout deste plano.`);
  }

  throw new ApiError(
    501,
    `Provider ${provider.toLowerCase()} ainda nao implementa checkout. A estrutura interna ja esta pronta.`
  );
}

export async function createBillingPortalSession(workspaceId) {
  const provider = normalizeBillingProvider();
  const customer = await ensureBillingCustomer(workspaceId, { provider });

  if (provider === "MANUAL") {
    throw new ApiError(501, "Portal de pagamento indisponivel ate configurar um gateway.");
  }

  if (!customer.providerCustomerId) {
    throw new ApiError(409, "Cliente de billing ainda nao possui identificador no provider.");
  }

  throw new ApiError(
    501,
    `Provider ${provider.toLowerCase()} ainda nao implementa portal. A estrutura interna ja esta pronta.`
  );
}

async function workspaceIdFromBillingPayload(provider, data = {}) {
  if (data.workspaceId) return String(data.workspaceId);

  const providerSubscriptionId = optionalString(data.providerSubscriptionId || data.subscriptionId || data.subscription?.id, 180);
  if (providerSubscriptionId) {
    const subscription = await prisma.billingSubscription.findUnique({
      where: { provider_providerSubscriptionId: { provider, providerSubscriptionId } },
      select: { workspaceId: true }
    });
    if (subscription?.workspaceId) return subscription.workspaceId;
  }

  const providerCustomerId = optionalString(data.providerCustomerId || data.customerId || data.customer?.id, 180);
  if (providerCustomerId) {
    const customer = await prisma.billingCustomer.findUnique({
      where: { provider_providerCustomerId: { provider, providerCustomerId } },
      select: { workspaceId: true }
    });
    if (customer?.workspaceId) return customer.workspaceId;
  }

  return "";
}

async function applySubscriptionPayload(provider, data = {}) {
  const workspaceId = await workspaceIdFromBillingPayload(provider, data);
  if (!workspaceId) return { status: "IGNORED", reason: "workspace_not_found" };

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, plan: true, planStatus: true }
  });
  if (!workspace) return { status: "IGNORED", reason: "workspace_not_found" };

  const providerCustomerId = optionalString(data.providerCustomerId || data.customerId || data.customer?.id, 180);
  const providerSubscriptionId = optionalString(data.providerSubscriptionId || data.subscriptionId || data.subscription?.id, 180);
  const providerPriceId = optionalString(data.providerPriceId || data.priceId || data.price?.id, 180);
  const plan = data.plan || data.platformPlan ? normalizePlanSlug(data.plan || data.platformPlan) : normalizePlanSlug(workspace.plan);
  const status = normalizeSubscriptionStatus(data.status || data.subscriptionStatus, workspace.planStatus || "TRIAL");
  const currentPeriodStart = toDate(data.currentPeriodStart || data.current_period_start);
  const currentPeriodEnd = toDate(data.currentPeriodEnd || data.current_period_end || data.paidUntil);
  const trialEndsAt = toDate(data.trialEndsAt || data.trial_end);
  const cancelAtPeriodEnd = Boolean(data.cancelAtPeriodEnd || data.cancel_at_period_end);
  const canceledAt = toDate(data.canceledAt || data.canceled_at);

  const customer = await ensureBillingCustomer(workspaceId, {
    provider,
    providerCustomerId,
    email: data.email || data.customerEmail,
    name: data.name || data.customerName,
    metadata: data.customerMetadata || {}
  });

  const subscriptionData = {
    workspaceId,
    billingCustomerId: customer.id,
    provider,
    providerSubscriptionId,
    providerPriceId,
    plan,
    status,
    currentPeriodStart,
    currentPeriodEnd,
    trialEndsAt,
    cancelAtPeriodEnd,
    canceledAt,
    metadata: data.metadata || {}
  };

  if (providerSubscriptionId) {
    await prisma.billingSubscription.upsert({
      where: { provider_providerSubscriptionId: { provider, providerSubscriptionId } },
      create: subscriptionData,
      update: subscriptionData
    });
  } else {
    const existing = await prisma.billingSubscription.findFirst({
      where: { workspaceId, provider },
      orderBy: [{ updatedAt: "desc" }]
    });
    if (existing) {
      await prisma.billingSubscription.update({ where: { id: existing.id }, data: subscriptionData });
    } else {
      await prisma.billingSubscription.create({ data: subscriptionData });
    }
  }

  await syncWorkspaceBillingState({ workspaceId, plan, status, currentPeriodEnd, trialEndsAt, billingEnabled: true });
  return { status: "PROCESSED", workspaceId };
}

async function applyInvoicePayload(provider, data = {}) {
  const workspaceId = await workspaceIdFromBillingPayload(provider, data);
  if (!workspaceId) return { status: "IGNORED", reason: "workspace_not_found" };

  const providerSubscriptionId = optionalString(data.providerSubscriptionId || data.subscriptionId || data.subscription?.id, 180);
  const subscription = providerSubscriptionId
    ? await prisma.billingSubscription.findUnique({
        where: { provider_providerSubscriptionId: { provider, providerSubscriptionId } },
        select: { id: true }
      })
    : null;

  const providerInvoiceId = optionalString(data.providerInvoiceId || data.invoiceId || data.invoice?.id || data.id, 180);
  const providerPaymentId = optionalString(data.providerPaymentId || data.paymentId || data.paymentIntentId, 180);
  const providerCheckoutSessionId = optionalString(data.providerCheckoutSessionId || data.checkoutSessionId, 180);
  const amount = Number(data.amount ?? data.amountPaid ?? data.total ?? 0);
  const status = normalizeInvoiceStatus(data.status || data.invoiceStatus, providerPaymentId ? "PAID" : "OPEN");
  const invoiceData = {
    workspaceId,
    billingSubscriptionId: subscription?.id || null,
    provider,
    providerInvoiceId,
    providerPaymentId,
    providerCheckoutSessionId,
    amount: Number.isFinite(amount) ? amount : 0,
    currency: optionalString(data.currency, 12) || "BRL",
    status,
    dueAt: toDate(data.dueAt || data.due_date),
    paidAt: toDate(data.paidAt || data.paid_at),
    hostedUrl: optionalString(data.hostedUrl || data.hosted_invoice_url, 1000),
    pdfUrl: optionalString(data.pdfUrl || data.invoice_pdf, 1000),
    metadata: data.metadata || {}
  };

  if (providerInvoiceId) {
    await prisma.billingInvoice.upsert({
      where: { provider_providerInvoiceId: { provider, providerInvoiceId } },
      create: invoiceData,
      update: invoiceData
    });
  } else {
    await prisma.billingInvoice.create({ data: invoiceData });
  }

  return { status: "PROCESSED", workspaceId };
}

async function applyBillingWebhook(provider, event) {
  const type = String(event.type || "").trim();
  const data = event.data && typeof event.data === "object" ? event.data : {};

  if (["billing.subscription.updated", "subscription.updated", "customer.subscription.updated", "customer.subscription.created", "checkout.session.completed"].includes(type)) {
    return applySubscriptionPayload(provider, data);
  }

  if (["billing.invoice.updated", "invoice.updated", "invoice.payment_succeeded", "invoice.payment_failed", "payment.succeeded"].includes(type)) {
    return applyInvoicePayload(provider, data);
  }

  return { status: "IGNORED", reason: "event_type_not_mapped" };
}

export async function processBillingWebhook(providerValue, event) {
  const provider = normalizeBillingProvider(providerValue);
  const eventId = optionalString(event.id, 180) || `${provider.toLowerCase()}_${Date.now()}`;
  const eventType = optionalString(event.type, 180) || "billing.event";
  const existing = await prisma.billingWebhookEvent.findUnique({
    where: { provider_eventId: { provider, eventId } }
  });

  if (existing?.status === "PROCESSED" || existing?.status === "IGNORED") {
    return { duplicate: true, event: publicBillingWebhookEvent(existing) };
  }

  const record = existing
    ? await prisma.billingWebhookEvent.update({
        where: { id: existing.id },
        data: {
          status: "RECEIVED",
          eventType,
          payload: event.payload || event,
          errorMessage: null,
          processedAt: null
        }
      })
    : await prisma.billingWebhookEvent.create({
        data: {
          provider,
          eventId,
          eventType,
          status: "RECEIVED",
          payload: event.payload || event
        }
      });

  try {
    const result = await applyBillingWebhook(provider, event);
    const status = result.status === "PROCESSED" ? "PROCESSED" : "IGNORED";
    const updated = await prisma.billingWebhookEvent.update({
      where: { id: record.id },
      data: {
        workspaceId: result.workspaceId || null,
        status,
        errorMessage: result.reason || null,
        processedAt: new Date()
      }
    });
    return { duplicate: false, event: publicBillingWebhookEvent(updated), result };
  } catch (error) {
    const updated = await prisma.billingWebhookEvent.update({
      where: { id: record.id },
      data: {
        status: "FAILED",
        errorMessage: String(error?.message || "Falha ao processar webhook.").slice(0, 1000),
        processedAt: new Date()
      }
    });
    return { duplicate: false, event: publicBillingWebhookEvent(updated), error };
  }
}
