const SUBSCRIPTIONS_KEY = "agensync_local_subscriptions_v1";

const pad = (value) => String(value).padStart(2, "0");

function today() {
  return formatInputDate(new Date());
}

function formatInputDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseInputDate(value) {
  return new Date(`${value}T00:00:00`);
}

function monthKey(value) {
  return String(value || today()).slice(0, 7);
}

function startOfMonth(value) {
  const date = parseInputDate(`${monthKey(value)}-01`);
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function nextMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function monthEndDate(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber, 0).getDate();
}

function dueDateForMonth(month, dueDay) {
  const safeDay = Math.max(1, Math.min(Number(dueDay || 1), monthEndDate(month)));
  return `${month}-${pad(safeDay)}`;
}

function id(prefix = "subscription") {
  if (window.crypto?.randomUUID) return `${prefix}_${window.crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function now() {
  return new Date().toISOString();
}

function seedSubscriptions() {
  const currentMonth = monthKey(today());
  const previous = startOfMonth(today());
  previous.setMonth(previous.getMonth() - 1);
  const previousMonth = formatInputDate(previous).slice(0, 7);
  const createdAt = now();

  return [
    {
      id: "subscription_maria_manutencao",
      clientId: "client_maria",
      clientName: "Maria Oliveira",
      planName: "Manutenção mensal",
      amount: 180,
      dueDay: 10,
      startDate: `${previousMonth}-10`,
      status: "active",
      notes: "Inclui manutenção e revisão do atendimento.",
      payments: [
        { month: previousMonth, status: "paid", paidAt: `${previousMonth}-10`, amount: 180 },
        { month: currentMonth, status: "paid", paidAt: `${currentMonth}-10`, amount: 180 }
      ],
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "subscription_joao_barbearia",
      clientId: "client_joao",
      clientName: "João Pereira",
      planName: "Plano mensal barbeiro",
      amount: 120,
      dueDay: 5,
      startDate: `${currentMonth}-05`,
      status: "active",
      notes: "Corte e barba com prioridade de agenda.",
      payments: [{ month: currentMonth, status: "pending", paidAt: "", amount: 120 }],
      createdAt,
      updatedAt: createdAt
    },
    {
      id: "subscription_camila_estetica",
      clientId: "client_camila",
      clientName: "Camila Santos",
      planName: "Acompanhamento estético",
      amount: 240,
      dueDay: 1,
      startDate: `${previousMonth}-01`,
      status: "active",
      notes: "Sessões de acompanhamento e orientações mensais.",
      payments: [{ month: previousMonth, status: "paid", paidAt: `${previousMonth}-02`, amount: 240 }],
      createdAt,
      updatedAt: createdAt
    }
  ];
}

function readSubscriptions() {
  const raw = localStorage.getItem(SUBSCRIPTIONS_KEY);
  if (!raw) {
    const seeded = seedSubscriptions();
    localStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error("invalid");
    return data;
  } catch {
    const seeded = seedSubscriptions();
    localStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function writeSubscriptions(subscriptions) {
  localStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(subscriptions));
}

function normalizePayment(payment = {}) {
  return {
    month: monthKey(payment.month || today()),
    status: payment.status === "paid" ? "paid" : payment.status === "pending" ? "pending" : "",
    paidAt: payment.paidAt || "",
    amount: Number(payment.amount || 0),
    manual: Boolean(payment.manual)
  };
}

function publicSubscription(subscription) {
  return {
    ...subscription,
    amount: Number(subscription.amount || 0),
    dueDay: Number(subscription.dueDay || 1),
    status: subscription.status === "canceled" ? "canceled" : "active",
    notes: subscription.notes || "",
    payments: Array.isArray(subscription.payments) ? subscription.payments.map(normalizePayment) : []
  };
}

function validateSubscription(payload) {
  if (!String(payload.clientId || "").trim()) throw new Error("Cliente é obrigatório.");
  if (!String(payload.planName || "").trim()) throw new Error("Nome do plano é obrigatório.");
  if (!String(payload.startDate || "").trim()) throw new Error("Data de início é obrigatória.");

  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Valor mensal deve ser maior que zero.");

  const dueDay = Number(payload.dueDay);
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    throw new Error("Dia de vencimento deve ficar entre 1 e 31.");
  }
}

function cycleStatus(subscription, payment, dueDate) {
  if (payment?.status === "paid") return "paid";
  if (payment?.status === "pending" && payment.manual) return "pending";
  return dueDate < today() ? "overdue" : "pending";
}

function cycleForMonth(subscription, month) {
  const publicItem = publicSubscription(subscription);
  const payment = publicItem.payments.find((item) => item.month === month);
  const dueDate = dueDateForMonth(month, publicItem.dueDay);
  const status = cycleStatus(publicItem, payment, dueDate);

  return {
    id: `${publicItem.id}_${month}`,
    subscriptionId: publicItem.id,
    clientId: publicItem.clientId,
    clientName: publicItem.clientName || "Cliente",
    planName: publicItem.planName,
    amount: payment?.amount || publicItem.amount,
    dueDay: publicItem.dueDay,
    dueDate,
    month,
    status,
    paidAt: payment?.paidAt || "",
    subscriptionStatus: publicItem.status,
    notes: publicItem.notes
  };
}

function shouldIncludeSubscriptionInMonth(subscription, month) {
  if (month < monthKey(subscription.startDate)) return false;
  if (subscription.status === "canceled" && subscription.canceledAt && month > monthKey(subscription.canceledAt)) {
    return false;
  }
  return true;
}

export function subscriptionStatusLabel(status) {
  if (status === "paid") return "Pago";
  if (status === "overdue") return "Atrasado";
  if (status === "canceled") return "Cancelada";
  return "Pendente";
}

export function listSubscriptions(filters = {}) {
  const currentMonth = monthKey(filters.month || today());

  return readSubscriptions()
    .map(publicSubscription)
    .filter((subscription) => !filters.status || subscription.status === filters.status)
    .filter((subscription) => {
      const search = String(filters.search || "").trim().toLowerCase();
      if (!search) return true;
      return [subscription.clientName, subscription.planName, subscription.notes]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(search));
    })
    .map((subscription) => ({
      ...subscription,
      currentCycle: shouldIncludeSubscriptionInMonth(subscription, currentMonth)
        ? cycleForMonth(subscription, currentMonth)
        : null
    }))
    .sort((first, second) => first.clientName.localeCompare(second.clientName));
}

export function listSubscriptionCycles(filters = {}) {
  const startDate = filters.startDate || `${monthKey(today())}-01`;
  const endDate = filters.endDate || today();
  const start = startOfMonth(startDate);
  const end = startOfMonth(endDate);
  const cycles = [];

  readSubscriptions()
    .map(publicSubscription)
    .forEach((subscription) => {
      let cursor = start;
      while (cursor <= end) {
        const month = formatInputDate(cursor).slice(0, 7);
        if (shouldIncludeSubscriptionInMonth(subscription, month)) {
          const cycle = cycleForMonth(subscription, month);
          const paidInRange = cycle.status === "paid" && cycle.paidAt >= startDate && cycle.paidAt <= endDate;
          const dueInRange = cycle.dueDate >= startDate && cycle.dueDate <= endDate;
          if (dueInRange || paidInRange) cycles.push(cycle);
        }
        cursor = nextMonth(cursor);
      }
    });

  return cycles
    .filter((cycle) => !filters.status || cycle.status === filters.status)
    .sort((first, second) => `${second.dueDate}${second.clientName}`.localeCompare(`${first.dueDate}${first.clientName}`));
}

export function subscriptionSummary(filters = {}) {
  const month = monthKey(filters.month || filters.endDate || today());
  const cycles = listSubscriptionCycles({
    startDate: `${month}-01`,
    endDate: `${month}-${pad(monthEndDate(month))}`
  });
  const activeCount = listSubscriptions({ month }).filter((subscription) => subscription.status === "active").length;
  const pending = cycles.filter((cycle) => cycle.status === "pending").length;
  const overdue = cycles.filter((cycle) => cycle.status === "overdue").length;
  const paid = cycles.filter((cycle) => cycle.status === "paid").length;
  const expected = cycles.reduce((total, cycle) => total + Number(cycle.amount || 0), 0);
  const received = cycles
    .filter((cycle) => cycle.status === "paid")
    .reduce((total, cycle) => total + Number(cycle.amount || 0), 0);

  return { activeCount, pending, overdue, paid, expected, received, cycles };
}

export function createSubscription(payload) {
  validateSubscription(payload);
  const subscriptions = readSubscriptions();
  const createdAt = now();
  const startMonth = monthKey(payload.startDate);
  const subscription = {
    id: id(),
    clientId: payload.clientId,
    clientName: payload.clientName || "Cliente",
    planName: String(payload.planName || "").trim(),
    amount: Number(payload.amount),
    dueDay: Number(payload.dueDay),
    startDate: payload.startDate,
    status: payload.status === "canceled" ? "canceled" : "active",
    notes: String(payload.notes || "").trim(),
    payments: [{ month: startMonth, status: "pending", paidAt: "", amount: Number(payload.amount) }],
    createdAt,
    updatedAt: createdAt
  };

  subscriptions.push(subscription);
  writeSubscriptions(subscriptions);
  return publicSubscription(subscription);
}

export function updateSubscription(subscriptionId, payload) {
  validateSubscription(payload);
  const subscriptions = readSubscriptions();
  const subscription = subscriptions.find((item) => item.id === subscriptionId);
  if (!subscription) throw new Error("Mensalidade não encontrada.");

  subscription.clientId = payload.clientId;
  subscription.clientName = payload.clientName || subscription.clientName || "Cliente";
  subscription.planName = String(payload.planName || "").trim();
  subscription.amount = Number(payload.amount);
  subscription.dueDay = Number(payload.dueDay);
  subscription.startDate = payload.startDate;
  subscription.status = payload.status === "canceled" ? "canceled" : "active";
  subscription.notes = String(payload.notes || "").trim();
  subscription.updatedAt = now();

  writeSubscriptions(subscriptions);
  return publicSubscription(subscription);
}

export function cancelSubscription(subscriptionId) {
  const subscriptions = readSubscriptions();
  const subscription = subscriptions.find((item) => item.id === subscriptionId);
  if (!subscription) throw new Error("Mensalidade não encontrada.");

  subscription.status = "canceled";
  subscription.canceledAt = today();
  subscription.updatedAt = now();
  writeSubscriptions(subscriptions);
  return publicSubscription(subscription);
}

export function markSubscriptionPayment(subscriptionId, month, status) {
  const subscriptions = readSubscriptions();
  const subscription = subscriptions.find((item) => item.id === subscriptionId);
  if (!subscription) throw new Error("Mensalidade não encontrada.");

  const safeMonth = monthKey(month);
  const payments = Array.isArray(subscription.payments) ? subscription.payments : [];
  const existing = payments.find((payment) => payment.month === safeMonth);
  const nextStatus = status === "paid" ? "paid" : "pending";
  const payment = {
    month: safeMonth,
    status: nextStatus,
    paidAt: nextStatus === "paid" ? today() : "",
    amount: Number(subscription.amount || 0),
    manual: nextStatus === "pending"
  };

  if (existing) {
    existing.status = payment.status;
    existing.paidAt = payment.paidAt;
    existing.amount = payment.amount;
    existing.manual = payment.manual;
  } else {
    payments.push(payment);
  }

  subscription.payments = payments;
  subscription.updatedAt = now();
  writeSubscriptions(subscriptions);
  return cycleForMonth(subscription, safeMonth);
}

export function sumPaidSubscriptionCycles(cycles) {
  return cycles
    .filter((cycle) => cycle.status === "paid")
    .reduce((total, cycle) => total + Number(cycle.amount || 0), 0);
}

export function sumExpectedSubscriptionCycles(cycles) {
  return cycles.reduce((total, cycle) => total + Number(cycle.amount || 0), 0);
}
