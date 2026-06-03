import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import Button from "../components/Button.jsx";
import Card, { CardHeader } from "../components/Card.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Field, { inputClass, readOnlyInputClass } from "../components/Field.jsx";
import Message from "../components/Message.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useToast } from "../components/Toast.jsx";
import {
  cancelSubscription,
  createSubscription,
  generateSubscriptionAppointments,
  getSubscription,
  markSubscriptionPayment,
  previewSubscriptionSchedule,
  subscriptionStatusLabel,
  subscriptionsOverview,
  updateSubscription
} from "../services/subscriptions.js";
import { money, statusOptions, todayInputValue } from "../utils.js";

const emptyForm = {
  clientId: "",
  serviceId: "",
  professionalId: "",
  planName: "",
  billingType: "per_completed_session",
  priceMode: "service_price",
  sessionPrice: "",
  monthlyPrice: "",
  sessionsPerMonth: "4",
  recurrenceType: "weekly",
  weekdays: [],
  intervalDays: "2",
  monthDay: "1",
  manualDates: "",
  defaultStartTime: "09:00",
  startDate: todayInputValue(),
  endDate: "",
  dueDay: "10",
  status: "active",
  notes: "",
  generateAppointments: true,
  generationMonths: "1",
  skipConflicts: true
};

const wizardSteps = ["Cliente", "Servico", "Recorrencia", "Pagamento", "Revisao"];
const weekdayOptions = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sab" },
  { value: 0, label: "Dom" }
];

const billingLabels = {
  per_completed_session: "Por atendimento concluido",
  fixed_monthly: "Plano mensal fixo",
  package_monthly: "Pacote mensal"
};

const recurrenceLabels = {
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
  weekdays: "Dias especificos",
  every_x_days: "A cada X dias",
  manual_dates: "Datas manuais"
};

function monthKey(value = todayInputValue()) {
  return value.slice(0, 7);
}

function monthStart(month) {
  return `${month}-01`;
}

function monthEnd(month) {
  const [year, number] = month.split("-").map(Number);
  const lastDay = new Date(year, number, 0).getDate();
  return `${month}-${String(lastDay).padStart(2, "0")}`;
}

function addMonths(month, amount) {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(year, number - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(month) {
  const [year, number] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, number - 1, 1));
}

function dateLabel(value) {
  if (!value) return "";
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return day && month && year ? `${day}/${month}/${year}` : value;
}

function QuickCreateModal({ open, title, description, children, saving, onSubmit, onClose }) {
  if (!open) return null;

  return (
    <div className="agensync-overlay z-[90] flex items-end bg-slate-950/45 p-3 sm:items-center sm:justify-center">
      <form onSubmit={onSubmit} className="w-full rounded-xl border border-line bg-white p-5 shadow-panel sm:max-w-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-ink">{title}</h2>
            {description ? <p className="mt-1 text-sm leading-6 text-muted">{description}</p> : null}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar">
            Fechar
          </Button>
        </div>
        <div className="mt-5 space-y-4">{children}</div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Cadastrar
          </Button>
        </div>
      </form>
    </div>
  );
}

function SummaryCard({ label, value, helper, tone = "ink" }) {
  const toneClass =
    tone === "red" ? "text-red-600" : tone === "green" ? "text-success" : tone === "blue" ? "text-brand" : "text-ink";

  return (
    <article className="rounded-lg border border-[#E2E8F0] bg-white p-4 shadow-soft">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className={`mt-2 text-2xl font-black tracking-tight ${toneClass}`}>{value}</p>
      {helper ? <p className="mt-1 text-xs font-bold leading-5 text-muted">{helper}</p> : null}
    </article>
  );
}

function LoadingValue({ loading, children, className = "h-7 w-24" }) {
  if (!loading) return children;

  return (
    <span
      className={`skeleton-line inline-block max-w-full rounded-full align-middle ${className}`}
      aria-label="Carregando"
    />
  );
}

function PaymentBadge({ status }) {
  const styles = {
    paid: "bg-[#D1FAE5] text-success ring-green-200",
    pending: "bg-[#DBEAFE] text-brand ring-blue-200",
    overdue: "bg-red-100 text-red-700 ring-red-200",
    canceled: "bg-zinc-100 text-muted ring-zinc-200"
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ring-1 ${styles[status] || styles.pending}`}>
      {subscriptionStatusLabel(status)}
    </span>
  );
}

function PlanBadge({ status }) {
  const styles = {
    active: "bg-green-50 text-success ring-green-100",
    paused: "bg-amber-50 text-amber-700 ring-amber-100",
    canceled: "bg-red-50 text-danger ring-red-100"
  };
  const labels = { active: "Ativo", paused: "Pausado", canceled: "Cancelado" };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ring-1 ${styles[status] || styles.active}`}>
      {labels[status] || "Ativo"}
    </span>
  );
}

function recurrenceConfigFromForm(form) {
  const manualDates = form.manualDates
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (form.recurrenceType === "weekdays" || form.recurrenceType === "weekly") {
    return { weekdays: form.weekdays.map(Number) };
  }
  if (form.recurrenceType === "every_x_days") return { intervalDays: Number(form.intervalDays || 2) };
  if (form.recurrenceType === "monthly") return { monthDay: Number(form.monthDay || 1) };
  if (form.recurrenceType === "manual_dates") return { manualDates };
  return {};
}

function buildPayload(form) {
  return {
    clientId: form.clientId,
    serviceId: form.serviceId,
    professionalId: form.professionalId,
    planName: form.planName,
    billingType: form.billingType,
    priceMode: form.priceMode,
    sessionPrice: form.sessionPrice,
    monthlyPrice: form.monthlyPrice,
    amount: form.billingType === "per_completed_session" ? form.sessionPrice : form.monthlyPrice,
    sessionsPerMonth: Number(form.sessionsPerMonth || 1),
    recurrenceType: form.recurrenceType,
    recurrenceConfig: recurrenceConfigFromForm(form),
    defaultStartTime: form.defaultStartTime,
    startDate: form.startDate,
    endDate: form.endDate,
    dueDay: Number(form.dueDay || 10),
    status: form.status,
    notes: form.notes,
    generateAppointments: Boolean(form.generateAppointments),
    generationMonths: Number(form.generationMonths || 1),
    skipConflicts: Boolean(form.skipConflicts)
  };
}

function formFromPlan(plan) {
  const recurrenceConfig = plan.recurrenceConfig || {};
  return {
    ...emptyForm,
    clientId: plan.clientId || "",
    serviceId: plan.serviceId || "",
    professionalId: plan.professionalId || "",
    planName: plan.planName || "",
    billingType: plan.billingType || "fixed_monthly",
    priceMode: plan.priceMode || "monthly_price",
    sessionPrice: plan.sessionPrice ?? "",
    monthlyPrice: plan.monthlyPrice ?? plan.amount ?? "",
    sessionsPerMonth: String(plan.sessionsPerMonth || 1),
    recurrenceType: plan.recurrenceType || "monthly",
    weekdays: Array.isArray(recurrenceConfig.weekdays) ? recurrenceConfig.weekdays : [],
    intervalDays: String(recurrenceConfig.intervalDays || 2),
    monthDay: String(recurrenceConfig.monthDay || 1),
    manualDates: Array.isArray(recurrenceConfig.manualDates) ? recurrenceConfig.manualDates.join("\n") : "",
    defaultStartTime: plan.defaultStartTime || "09:00",
    startDate: plan.startDate || todayInputValue(),
    endDate: plan.endDate || "",
    dueDay: String(plan.dueDay || 10),
    status: plan.status || "active",
    notes: plan.notes || "",
    generateAppointments: Boolean(plan.generateAppointments),
    generationMonths: "1",
    skipConflicts: true
  };
}

function PaymentModal({ open, plan, cycle, saving, onClose, onSubmit }) {
  const [form, setForm] = useState({
    month: monthKey(),
    status: "paid",
    amount: "",
    dueDate: "",
    paidAt: todayInputValue(),
    paymentMethod: "",
    notes: ""
  });

  useEffect(() => {
    if (!open || !cycle) return;
    setForm({
      month: cycle.month || monthKey(),
      status: cycle.status === "paid" ? "paid" : "paid",
      amount: cycle.amount ?? plan?.monthlyPrice ?? plan?.amount ?? "",
      dueDate: cycle.dueDate || "",
      paidAt: cycle.paidAt || todayInputValue(),
      paymentMethod: cycle.paymentMethod || "",
      notes: cycle.notes || ""
    });
  }, [cycle, open, plan]);

  if (!open || !plan || !cycle) return null;

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="agensync-overlay z-[90] flex items-end bg-slate-950/45 p-3 sm:items-center sm:justify-center">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(form);
        }}
        className="w-full rounded-xl border border-line bg-white p-5 shadow-panel sm:max-w-lg"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">Pagamento</p>
            <h2 className="mt-1 text-xl font-black text-ink">{plan.clientName}</h2>
            <p className="mt-1 text-sm font-bold text-muted">{formatMonth(form.month)}</p>
          </div>
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Field label="Status">
            <select className={inputClass} value={form.status} onChange={(event) => update("status", event.target.value)}>
              <option value="paid">Pago</option>
              <option value="pending">Pendente</option>
              <option value="overdue">Atrasado</option>
              <option value="canceled">Cancelado</option>
            </select>
          </Field>
          <Field label="Valor">
            <input className={inputClass} type="number" min="0" step="0.01" value={form.amount} onChange={(event) => update("amount", event.target.value)} />
          </Field>
          <Field label="Vencimento">
            <input className={inputClass} type="date" value={form.dueDate} onChange={(event) => update("dueDate", event.target.value)} />
          </Field>
          <Field label="Data de pagamento">
            <input className={inputClass} type="date" value={form.paidAt} onChange={(event) => update("paidAt", event.target.value)} />
          </Field>
          <Field label="Forma de pagamento" className="sm:col-span-2">
            <input className={inputClass} value={form.paymentMethod} onChange={(event) => update("paymentMethod", event.target.value)} placeholder="Pix, dinheiro, cartao..." />
          </Field>
          <Field label="Observacao" className="sm:col-span-2">
            <textarea className={`${inputClass} min-h-24 resize-none`} value={form.notes} onChange={(event) => update("notes", event.target.value)} />
          </Field>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Salvar pagamento
          </Button>
        </div>
      </form>
    </div>
  );
}

function PlanDetailModal({ plan, activeTab, onTabChange, onClose, onEdit, onGenerate, onPayment, onUpdateSession }) {
  if (!plan) return null;

  const tabs = [
    ["summary", "Resumo"],
    ["sessions", "Sessoes"],
    ["payments", "Pagamentos"],
    ["history", "Historico"],
    ["settings", "Configuracoes"]
  ];
  const sessions = plan.appointments || [];
  const payments = plan.payments || [];
  const nextSession = sessions.find((session) => session.status === "agendado") || plan.nextSessions?.[0];

  return (
    <div className="agensync-overlay z-[80] flex items-end bg-slate-950/45 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
      <div className="max-h-[92dvh] w-full overflow-hidden rounded-t-[28px] border border-line bg-white shadow-panel sm:max-w-5xl sm:rounded-2xl">
        <header className="flex flex-col gap-4 border-b border-line p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">Mensalista</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-black text-ink">{plan.clientName}</h2>
              <PlanBadge status={plan.status} />
            </div>
            <p className="mt-1 text-sm font-bold text-muted">{plan.planName}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button variant="secondary" onClick={() => onEdit(plan)}>
              Editar
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </header>

        <div className="flex gap-2 overflow-x-auto border-b border-line bg-[#F8FAFC] p-3">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className={`min-h-10 shrink-0 rounded-xl px-4 text-sm font-black transition ${
                activeTab === id ? "bg-brand text-white shadow-soft" : "bg-white text-muted hover:text-brand"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="max-h-[calc(92dvh-160px)] overflow-y-auto p-4 sm:p-5">
          {activeTab === "summary" ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <SummaryCard label="Servico" value={plan.serviceName || "Nao informado"} helper={plan.professionalName || "Profissional automatico"} />
              <SummaryCard label="Recorrencia" value={recurrenceLabels[plan.recurrenceType] || plan.recurrenceType} helper={`${plan.sessionsPerMonth || 1} atendimento(s)/mes`} tone="blue" />
              <SummaryCard label="Valor" value={plan.billingType === "per_completed_session" ? money(plan.sessionPrice || plan.amount) : money(plan.monthlyPrice || plan.amount)} helper={billingLabels[plan.billingType]} tone="green" />
              <article className="rounded-lg border border-line bg-white p-4 lg:col-span-3">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Proxima sessao</p>
                {nextSession ? (
                  <p className="mt-2 text-lg font-black text-ink">
                    {dateLabel(nextSession.date)} as {nextSession.startTime}
                  </p>
                ) : (
                  <p className="mt-2 text-sm font-bold text-muted">Nenhuma sessao futura gerada.</p>
                )}
              </article>
            </div>
          ) : null}

          {activeTab === "sessions" ? (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-black text-ink">Sessoes geradas</h3>
                  <p className="text-sm font-bold text-muted">Cada sessao e um agendamento real na agenda.</p>
                </div>
                <Button onClick={() => onGenerate(plan)}>Gerar agenda</Button>
              </div>
              {sessions.length ? (
                sessions.map((session) => (
                  <article key={session.id} className="grid gap-3 rounded-lg border border-line bg-white p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-ink">
                          {dateLabel(session.date)} - {session.startTime} as {session.endTime}
                        </p>
                        <StatusBadge status={session.status} />
                      </div>
                      <p className="mt-1 text-sm font-bold text-muted">{session.professional?.name || plan.professionalName}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="success" disabled={session.status === "concluido"} onClick={() => onUpdateSession(session, "concluido")}>
                        Concluir
                      </Button>
                      <Button variant="danger" disabled={session.status === "cancelado"} onClick={() => onUpdateSession(session, "cancelado")}>
                        Cancelar
                      </Button>
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState title="Nenhuma sessao gerada" description="Use Gerar agenda para criar atendimentos reais conforme a recorrencia." />
              )}
            </div>
          ) : null}

          {activeTab === "payments" ? (
            <div className="space-y-3">
              {payments.length ? (
                payments.map((payment) => (
                  <article key={payment.id || payment.month} className="grid gap-3 rounded-lg border border-line bg-white p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-ink">{formatMonth(payment.month)}</p>
                        <PaymentBadge status={payment.status} />
                      </div>
                      <p className="mt-1 text-sm font-bold text-muted">
                        {money(payment.amount)} {payment.dueDate ? `- vence ${dateLabel(payment.dueDate)}` : ""}
                      </p>
                      {payment.paidAt ? <p className="mt-1 text-xs font-black text-success">Pago em {dateLabel(payment.paidAt)}</p> : null}
                    </div>
                    <Button variant={payment.status === "paid" ? "secondary" : "success"} onClick={() => onPayment(plan, payment)}>
                      {payment.status === "paid" ? "Editar pagamento" : "Registrar pagamento"}
                    </Button>
                  </article>
                ))
              ) : (
                <EmptyState title="Sem competencias" description="Planos por atendimento concluido nao precisam de cobranca mensal fixa." />
              )}
            </div>
          ) : null}

          {activeTab === "history" ? (
            <div className="space-y-3">
              {sessions.filter((session) => session.status !== "agendado").length ? (
                sessions
                  .filter((session) => session.status !== "agendado")
                  .map((session) => (
                    <article key={session.id} className="rounded-lg border border-line bg-white p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-ink">{dateLabel(session.date)} - {session.startTime}</p>
                        <StatusBadge status={session.status} />
                      </div>
                      <p className="mt-1 text-sm font-bold text-muted">{session.service?.name || plan.serviceName}</p>
                    </article>
                  ))
              ) : (
                <EmptyState title="Historico vazio" description="Conclusoes, cancelamentos e faltas aparecem aqui." />
              )}
            </div>
          ) : null}

          {activeTab === "settings" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <SummaryCard label="Inicio" value={dateLabel(plan.startDate)} helper={plan.endDate ? `Fim ${dateLabel(plan.endDate)}` : "Sem data final"} />
              <SummaryCard label="Agenda automatica" value={plan.generateAppointments ? "Ativa" : "Desativada"} helper={plan.generatedUntil ? `Gerada ate ${dateLabel(plan.generatedUntil)}` : "Sem geracao registrada"} tone="blue" />
              <article className="rounded-lg border border-line bg-white p-4 md:col-span-2">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Observacoes</p>
                <p className="mt-2 whitespace-pre-wrap text-sm font-bold leading-6 text-muted">{plan.notes || "Sem observacoes."}</p>
              </article>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function Subscriptions() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const currentMonth = monthKey();
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [wizardStep, setWizardStep] = useState(0);
  const [editing, setEditing] = useState("");
  const [pendingCancel, setPendingCancel] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [summary, setSummary] = useState({ activeCount: 0, sessionsExpected: 0, sessionsCompleted: 0, expected: 0, received: 0, pending: 0, overdue: 0 });
  const [detailPlan, setDetailPlan] = useState(null);
  const [detailTab, setDetailTab] = useState("summary");
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [preview, setPreview] = useState({ preview: [], conflicts: [], availableCount: 0 });
  const [previewLoading, setPreviewLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [quickClientForm, setQuickClientForm] = useState({ name: "", phone: "", notes: "" });
  const [quickSaving, setQuickSaving] = useState(false);
  const [filters, setFilters] = useState({ status: "", billingType: "", professionalId: "", clientId: "" });
  const [error, setError] = useState("");

  const selectedService = services.find((service) => service.id === form.serviceId);
  const selectedProfessional = professionals.find((professional) => professional.id === form.professionalId);
  const visiblePreview = preview.preview.slice(0, 8);
  const fixedBilling = form.billingType !== "per_completed_session";

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    const params = {
      month: currentMonth,
      ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value))
    };

    subscriptionsOverview(params)
      .then((overview) => {
        if (!active) return;

        const activeProfessionals = (overview.bootstrap?.professionals || []).filter(
          (professional) => professional.isActive !== false
        );

        setClients(overview.bootstrap?.clients || []);
        setServices((overview.bootstrap?.services || []).filter((service) => service.isActive !== false));
        setProfessionals(activeProfessionals);
        setSubscriptions(overview.monthlyPlans || []);
        setSummary(overview.summary || {});

        if (activeProfessionals.length === 1) {
          setForm((current) =>
            current.professionalId ? current : { ...current, professionalId: activeProfessionals[0].id }
          );
        }
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentMonth, filters, refreshKey]);

  useEffect(() => {
    const planId = new URLSearchParams(location.search).get("plano");
    if (!planId) return;
    getSubscription(planId)
      .then((plan) => {
        setDetailPlan(plan);
        setDetailTab("summary");
      })
      .catch((err) => showToast(err.message, "error"));
  }, [location.search, refreshKey, showToast]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setEditing("");
    setWizardStep(0);
    setPreview({ preview: [], conflicts: [], availableCount: 0 });
    setForm((current) => ({
      ...emptyForm,
      professionalId: professionals.length === 1 ? professionals[0].id : current.professionalId && professionals.some((item) => item.id === current.professionalId) ? current.professionalId : ""
    }));
  }

  function startEdit(plan) {
    setEditing(plan.id);
    setForm(formFromPlan(plan));
    setWizardStep(0);
    setPreview({ preview: [], conflicts: [], availableCount: 0 });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleWeekday(day) {
    setForm((current) => {
      const exists = current.weekdays.includes(day);
      return {
        ...current,
        weekdays: exists ? current.weekdays.filter((item) => item !== day) : [...current.weekdays, day]
      };
    });
  }

  function handleServiceChange(serviceId) {
    const service = services.find((item) => item.id === serviceId);
    setForm((current) => ({
      ...current,
      serviceId,
      planName: current.planName || service?.name || "",
      sessionPrice: current.priceMode === "service_price" ? service?.priceDefault || "" : current.sessionPrice,
      monthDay: String(new Date(`${current.startDate}T00:00:00`).getDate() || 1)
    }));
  }

  function handleBillingTypeChange(value) {
    setForm((current) => ({
      ...current,
      billingType: value,
      priceMode: value === "per_completed_session" ? "service_price" : "monthly_price"
    }));
  }

  async function createQuickClient(event) {
    event.preventDefault();
    setQuickSaving(true);
    setError("");

    try {
      const result = await api.createClient(quickClientForm);
      setClients((current) => [...current, result.client].sort((first, second) => first.name.localeCompare(second.name)));
      updateForm("clientId", result.client.id);
      setQuickClientForm({ name: "", phone: "", notes: "" });
      setQuickClientOpen(false);
      showToast("Cliente cadastrado e selecionado.");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setQuickSaving(false);
    }
  }

  async function loadPreview() {
    setPreviewLoading(true);
    setError("");

    try {
      const data = await previewSubscriptionSchedule({
        ...buildPayload({ ...form, generateAppointments: true }),
        previewEndDate: monthEnd(addMonths(monthKey(form.startDate), Number(form.generationMonths || 1) - 1))
      });
      setPreview(data);
      if (data.conflicts?.length) showToast("Conflitos encontrados no preview.", "error");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = buildPayload(form);
      const plan = editing ? await updateSubscription(editing, payload) : await createSubscription(payload);
      setRefreshKey((current) => current + 1);
      showToast(editing ? "Mensalidade atualizada." : "Mensalidade criada.");
      if (!editing && payload.generateAppointments) {
        showToast("Agenda recorrente gerada conforme disponibilidade.");
      }
      resetForm();
      setDetailPlan(plan);
      setDetailTab("summary");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(plan, tab = "summary") {
    try {
      const fresh = await getSubscription(plan.id);
      setDetailPlan(fresh);
      setDetailTab(tab);
      navigate(`/mensalidades?plano=${plan.id}`, { replace: true });
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function generateAgenda(plan) {
    try {
      const result = await generateSubscriptionAppointments(plan.id, { generationMonths: 1, skipConflicts: true });
      setRefreshKey((current) => current + 1);
      showToast(`${result.generation?.generatedCount || 0} atendimento(s) gerado(s).`);
      const fresh = await getSubscription(plan.id);
      setDetailPlan(fresh);
      setDetailTab("sessions");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function updateSession(session, status) {
    try {
      await api.updateAppointment(session.id, { status });
      showToast("Sessao atualizada.");
      if (detailPlan) {
        const fresh = await getSubscription(detailPlan.id);
        setDetailPlan(fresh);
      }
      setRefreshKey((current) => current + 1);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function savePayment(paymentForm) {
    if (!paymentTarget) return;
    setPaymentSaving(true);
    try {
      await markSubscriptionPayment(paymentTarget.plan.id, paymentForm.month, paymentForm.status, paymentForm);
      showToast(paymentForm.status === "paid" ? "Pagamento registrado." : "Pagamento atualizado.");
      setPaymentTarget(null);
      setRefreshKey((current) => current + 1);
      const fresh = await getSubscription(paymentTarget.plan.id);
      setDetailPlan(fresh);
      setDetailTab("payments");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setPaymentSaving(false);
    }
  }

  async function quickMarkPayment(plan, status) {
    if (!plan.currentCycle) return;
    try {
      await markSubscriptionPayment(plan.id, plan.currentCycle.month, status, {
        amount: plan.currentCycle.amount,
        dueDate: plan.currentCycle.dueDate,
        paidAt: status === "paid" ? todayInputValue() : ""
      });
      setRefreshKey((current) => current + 1);
      showToast(status === "paid" ? "Mensalidade marcada como paga." : "Mensalidade voltou para pendente.");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function confirmCancel() {
    if (!pendingCancel) return;
    try {
      await cancelSubscription(pendingCancel.id);
      if (editing === pendingCancel.id) resetForm();
      setRefreshKey((current) => current + 1);
      showToast("Mensalidade cancelada.");
      setPendingCancel(null);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  const formSummary = useMemo(() => {
    const clientName = clients.find((client) => client.id === form.clientId)?.name || "Cliente";
    const serviceName = selectedService?.name || "Servico";
    const price =
      form.billingType === "per_completed_session"
        ? form.priceMode === "service_price"
          ? selectedService?.priceDefault || 0
          : Number(form.sessionPrice || 0)
        : Number(form.monthlyPrice || 0);
    return {
      clientName,
      serviceName,
      professionalName: selectedProfessional?.name || (professionals.length === 1 ? professionals[0]?.name : "A definir"),
      price
    };
  }, [clients, form, professionals, selectedProfessional, selectedService]);

  const isInitialLoading =
    loading &&
    !subscriptions.length &&
    !clients.length &&
    !services.length &&
    !professionals.length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Mensalidades"
        description="Cadastre mensalistas, gere agenda recorrente e acompanhe pagamentos sem misturar previsto com realizado."
      />

      <Message type="error" actionLabel="Limpar" onAction={() => setError("")}>
        {error}
      </Message>
      <Message>{loading && !isInitialLoading ? "Atualizando mensalidades..." : ""}</Message>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        <SummaryCard label="Ativos" value={<LoadingValue loading={isInitialLoading} className="h-7 w-10">{summary.activeCount || 0}</LoadingValue>} helper="mensalistas ativos" tone="blue" />
        <SummaryCard label="Sessoes previstas" value={<LoadingValue loading={isInitialLoading} className="h-7 w-10">{summary.sessionsExpected || 0}</LoadingValue>} helper={formatMonth(currentMonth)} />
        <SummaryCard label="Concluidas" value={<LoadingValue loading={isInitialLoading} className="h-7 w-10">{summary.sessionsCompleted || 0}</LoadingValue>} helper="no periodo" tone="green" />
        <SummaryCard label="Receita prevista" value={<LoadingValue loading={isInitialLoading} className="h-7 w-24">{money(summary.expected || 0)}</LoadingValue>} helper="agenda + planos" />
        <SummaryCard label="Realizado" value={<LoadingValue loading={isInitialLoading} className="h-7 w-24">{money(summary.received || 0)}</LoadingValue>} helper="concluido ou pago" tone="green" />
        <SummaryCard label="Pendentes" value={<LoadingValue loading={isInitialLoading} className="h-7 w-10">{summary.pending || 0}</LoadingValue>} helper={<LoadingValue loading={isInitialLoading} className="h-3 w-20">{money(summary.pendingAmount || 0)}</LoadingValue>} tone="blue" />
        <SummaryCard label="Atrasados" value={<LoadingValue loading={isInitialLoading} className="h-7 w-10">{summary.overdue || 0}</LoadingValue>} helper="competencias vencidas" tone="red" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[430px_minmax(0,1fr)] xl:items-start">
        <Card as="form" onSubmit={handleSubmit} className="space-y-4 p-4 xl:sticky xl:top-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">
              {editing ? "Editar mensalista" : "Novo mensalista"}
            </p>
            <h2 className="mt-2 text-xl font-black tracking-tight text-ink">
              {editing ? "Atualizar recorrencia" : "Cadastro guiado"}
            </h2>
            <p className="mt-1 text-sm font-medium leading-6 text-muted">
              Configure cliente, servico, recorrencia, pagamento e preview antes de salvar.
            </p>
          </div>

          <div className="grid grid-cols-5 gap-1 rounded-lg border border-line bg-[#F8FAFC] p-1">
            {wizardSteps.map((step, index) => (
              <button
                key={step}
                type="button"
                onClick={() => setWizardStep(index)}
                className={`min-h-10 rounded-md px-2 text-[11px] font-black transition sm:text-xs ${
                  wizardStep === index ? "bg-brand text-white shadow-soft" : "text-muted hover:bg-white hover:text-brand"
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <p className="text-sm font-black text-ink">{wizardSteps[wizardStep]}</p>

          {wizardStep === 0 ? (
            <div className="space-y-3">
              <Field
                label={
                  <span className="flex items-center justify-between gap-3">
                    <span>Cliente</span>
                    <Button variant="ghost" size="sm" className="px-2 text-[13px] font-black text-muted hover:text-brand" onClick={() => setQuickClientOpen(true)}>
                      + Novo
                    </Button>
                  </span>
                }
              >
                <select required value={form.clientId} onChange={(event) => updateForm("clientId", event.target.value)} className={inputClass}>
                  <option value="">Selecione um cliente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select value={form.status} onChange={(event) => updateForm("status", event.target.value)} className={inputClass}>
                  <option value="active">Ativo</option>
                  <option value="paused">Pausado</option>
                  <option value="canceled">Cancelado</option>
                </select>
              </Field>
            </div>
          ) : null}

          {wizardStep === 1 ? (
            <div className="space-y-3">
              <Field label="Servico">
                <select required value={form.serviceId} onChange={(event) => handleServiceChange(event.target.value)} className={inputClass}>
                  <option value="">Selecione um servico</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} - {money(service.priceDefault)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Profissional responsavel">
                <select required value={form.professionalId} onChange={(event) => updateForm("professionalId", event.target.value)} className={inputClass}>
                  <option value="">Selecione</option>
                  {professionals.map((professional) => (
                    <option key={professional.id} value={professional.id}>
                      {professional.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Nome do plano">
                <input required minLength={2} value={form.planName} onChange={(event) => updateForm("planName", event.target.value)} className={inputClass} placeholder="Ex: Drenagem semanal" />
              </Field>
              <Field label="Tipo de cobranca">
                <select value={form.billingType} onChange={(event) => handleBillingTypeChange(event.target.value)} className={inputClass}>
                  <option value="per_completed_session">Por atendimento concluido</option>
                  <option value="fixed_monthly">Plano mensal fixo</option>
                  <option value="package_monthly">Pacote mensal com sessoes</option>
                </select>
              </Field>
              <Field label="Modo de valor">
                <select value={form.priceMode} onChange={(event) => updateForm("priceMode", event.target.value)} className={inputClass}>
                  <option value="service_price">Usar preco do servico</option>
                  <option value="custom_session_price">Valor personalizado por atendimento</option>
                  <option value="monthly_price">Valor mensal do plano</option>
                </select>
              </Field>
              {form.priceMode === "service_price" ? (
                <Field label="Preco do servico">
                  <input readOnly className={readOnlyInputClass} value={selectedService ? money(selectedService.priceDefault) : "Selecione um servico"} />
                </Field>
              ) : form.priceMode === "monthly_price" ? (
                <Field label="Valor mensal">
                  <input required={fixedBilling} type="number" min="0" step="0.01" value={form.monthlyPrice} onChange={(event) => updateForm("monthlyPrice", event.target.value)} className={inputClass} />
                </Field>
              ) : (
                <Field label="Valor por atendimento">
                  <input required type="number" min="0" step="0.01" value={form.sessionPrice} onChange={(event) => updateForm("sessionPrice", event.target.value)} className={inputClass} />
                </Field>
              )}
            </div>
          ) : null}

          {wizardStep === 2 ? (
            <div className="space-y-3">
              <Field label="Quantidade por mes">
                <select value={form.sessionsPerMonth} onChange={(event) => updateForm("sessionsPerMonth", event.target.value)} className={inputClass}>
                  <option value="1">1x por mes</option>
                  <option value="2">2x por mes</option>
                  <option value="4">4x por mes</option>
                  <option value="8">Personalizado: 8x</option>
                </select>
              </Field>
              <Field label="Recorrencia">
                <select value={form.recurrenceType} onChange={(event) => updateForm("recurrenceType", event.target.value)} className={inputClass}>
                  <option value="weekly">Semanal</option>
                  <option value="biweekly">Quinzenal</option>
                  <option value="monthly">Mensal</option>
                  <option value="weekdays">Dias especificos da semana</option>
                  <option value="every_x_days">A cada X dias</option>
                  <option value="manual_dates">Datas manuais</option>
                </select>
              </Field>
              {form.recurrenceType === "weekly" || form.recurrenceType === "weekdays" ? (
                <div>
                  <p className="text-xs font-black text-ink">Dias da semana</p>
                  <div className="mt-2 grid grid-cols-7 gap-1">
                    {weekdayOptions.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleWeekday(day.value)}
                        className={`min-h-10 rounded-lg text-xs font-black transition ${
                          form.weekdays.includes(day.value) ? "bg-brand text-white" : "border border-line bg-white text-muted hover:text-brand"
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {form.recurrenceType === "every_x_days" ? (
                <Field label="Intervalo em dias">
                  <input type="number" min="1" value={form.intervalDays} onChange={(event) => updateForm("intervalDays", event.target.value)} className={inputClass} />
                </Field>
              ) : null}
              {form.recurrenceType === "monthly" ? (
                <Field label="Dia do mes">
                  <input type="number" min="1" max="31" value={form.monthDay} onChange={(event) => updateForm("monthDay", event.target.value)} className={inputClass} />
                </Field>
              ) : null}
              {form.recurrenceType === "manual_dates" ? (
                <Field label="Datas manuais" hint="Uma data por linha no formato AAAA-MM-DD.">
                  <textarea value={form.manualDates} onChange={(event) => updateForm("manualDates", event.target.value)} className={`${inputClass} min-h-28 resize-y`} />
                </Field>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Horario padrao">
                  <input required type="time" value={form.defaultStartTime} onChange={(event) => updateForm("defaultStartTime", event.target.value)} className={inputClass} />
                </Field>
                <Field label="Inicio">
                  <input required type="date" value={form.startDate} onChange={(event) => updateForm("startDate", event.target.value)} className={inputClass} />
                </Field>
              </div>
              <Field label="Fim opcional">
                <input type="date" value={form.endDate} onChange={(event) => updateForm("endDate", event.target.value)} className={inputClass} />
              </Field>
            </div>
          ) : null}

          {wizardStep === 3 ? (
            <div className="space-y-3">
              <Field label="Dia de vencimento">
                <input type="number" min="1" max="31" value={form.dueDay} onChange={(event) => updateForm("dueDay", event.target.value)} className={inputClass} disabled={!fixedBilling} />
              </Field>
              <label className="flex items-start gap-3 rounded-lg border border-line bg-[#F8FAFC] p-4">
                <input type="checkbox" checked={form.generateAppointments} onChange={(event) => updateForm("generateAppointments", event.target.checked)} className="mt-1 h-5 w-5 accent-blue-600" />
                <span>
                  <span className="block text-sm font-black text-ink">Gerar automaticamente na agenda</span>
                  <span className="mt-1 block text-xs font-bold leading-5 text-muted">Cria agendamentos reais que podem ser concluidos, reagendados ou cancelados.</span>
                </span>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Gerar por">
                  <select value={form.generationMonths} onChange={(event) => updateForm("generationMonths", event.target.value)} className={inputClass} disabled={!form.generateAppointments}>
                    <option value="1">1 mes</option>
                    <option value="2">2 meses</option>
                    <option value="3">3 meses</option>
                  </select>
                </Field>
                <label className="flex items-center gap-3 rounded-lg border border-line bg-white px-3 py-3">
                  <input type="checkbox" checked={form.skipConflicts} onChange={(event) => updateForm("skipConflicts", event.target.checked)} className="h-5 w-5 accent-blue-600" />
                  <span className="text-sm font-black text-ink">Gerar apenas horarios livres</span>
                </label>
              </div>
              <Field label="Observacoes">
                <textarea value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} className={`${inputClass} min-h-24 resize-none`} />
              </Field>
            </div>
          ) : null}

          {wizardStep === 4 ? (
            <div className="space-y-3">
              <article className="rounded-lg border border-line bg-[#F8FAFC] p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">Resumo</p>
                <div className="mt-3 space-y-2 text-sm font-bold text-muted">
                  <p><span className="text-ink">Cliente:</span> {formSummary.clientName}</p>
                  <p><span className="text-ink">Servico:</span> {formSummary.serviceName}</p>
                  <p><span className="text-ink">Profissional:</span> {formSummary.professionalName}</p>
                  <p><span className="text-ink">Cobranca:</span> {billingLabels[form.billingType]}</p>
                  <p><span className="text-ink">Valor:</span> {money(formSummary.price)}</p>
                  <p><span className="text-ink">Recorrencia:</span> {recurrenceLabels[form.recurrenceType]} as {form.defaultStartTime}</p>
                </div>
              </article>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="secondary" loading={previewLoading} loadingLabel="Gerando..." onClick={loadPreview} disabled={!form.generateAppointments}>
                  Atualizar preview
                </Button>
                <Button type="submit" loading={saving}>
                  {editing ? "Salvar alteracoes" : "Salvar mensalista"}
                </Button>
              </div>

              {preview.preview.length ? (
                <article className="rounded-lg border border-line bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-ink">Preview da agenda</p>
                    <span className="text-xs font-black text-muted">{preview.availableCount} livre(s)</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {visiblePreview.map((item) => (
                      <div key={`${item.date}-${item.startTime}`} className={`rounded-lg border px-3 py-2 text-sm font-bold ${item.hasConflict ? "border-red-200 bg-red-50 text-red-700" : "border-green-100 bg-green-50 text-success"}`}>
                        {dateLabel(item.date)} - {item.startTime} {item.hasConflict ? "(conflito)" : ""}
                      </div>
                    ))}
                  </div>
                </article>
              ) : null}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2 border-t border-line pt-4">
            <Button type="button" variant="secondary" disabled={wizardStep === 0} onClick={() => setWizardStep((current) => Math.max(current - 1, 0))}>
              Voltar
            </Button>
            {wizardStep < wizardSteps.length - 1 ? (
              <Button type="button" onClick={() => setWizardStep((current) => Math.min(current + 1, wizardSteps.length - 1))}>
                Continuar
              </Button>
            ) : (
              <Button type="button" variant="secondary" onClick={resetForm}>
                Limpar
              </Button>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="grid gap-3 lg:grid-cols-4">
              <Field label="Status">
                <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)} className={inputClass}>
                  <option value="">Todos</option>
                  <option value="active">Ativo</option>
                  <option value="paused">Pausado</option>
                  <option value="canceled">Cancelado</option>
                </select>
              </Field>
              <Field label="Cobranca">
                <select value={filters.billingType} onChange={(event) => updateFilter("billingType", event.target.value)} className={inputClass}>
                  <option value="">Todas</option>
                  <option value="per_completed_session">Por atendimento</option>
                  <option value="fixed_monthly">Mensal fixo</option>
                  <option value="package_monthly">Pacote</option>
                </select>
              </Field>
              <Field label="Profissional">
                <select value={filters.professionalId} onChange={(event) => updateFilter("professionalId", event.target.value)} className={inputClass}>
                  <option value="">Todos</option>
                  {professionals.map((professional) => (
                    <option key={professional.id} value={professional.id}>
                      {professional.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Cliente">
                <select value={filters.clientId} onChange={(event) => updateFilter("clientId", event.target.value)} className={inputClass}>
                  <option value="">Todos</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Card>

          <Card className="min-w-0 overflow-hidden">
            <CardHeader
              title="Clientes mensalistas"
              description={
                isInitialLoading ? (
                  <LoadingValue loading className="h-4 w-44">Carregando</LoadingValue>
                ) : (
                  `${subscriptions.length} mensalidade(s) cadastrada(s)`
                )
              }
            />
            <div className="compact-scroll-list divide-y divide-[#E2E8F0]">
              {isInitialLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <article
                    key={`subscription-loading-${index}`}
                    className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="skeleton-line h-5 w-40 rounded-full" />
                        <div className="skeleton-line h-6 w-16 rounded-full" />
                        <div className="skeleton-line h-6 w-20 rounded-full" />
                      </div>
                      <div className="mt-2 skeleton-line h-4 w-56 max-w-full rounded-full" />
                      <div className="mt-3 skeleton-line h-4 w-72 max-w-full rounded-full" />
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <div className="skeleton-line h-14 rounded-lg" />
                        <div className="skeleton-line h-14 rounded-lg" />
                        <div className="skeleton-line h-14 rounded-lg" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2 skeleton-line h-11 rounded-xl" />
                      <div className="skeleton-line h-11 rounded-xl" />
                      <div className="skeleton-line h-11 rounded-xl" />
                      <div className="col-span-2 skeleton-line h-11 rounded-xl" />
                    </div>
                  </article>
                ))
              ) : subscriptions.length ? (
                subscriptions.map((plan) => (
                  <article key={plan.id} className="grid gap-4 p-4 transition hover:bg-[#F8FAFC] xl:grid-cols-[minmax(0,1fr)_300px] xl:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-black text-ink">{plan.clientName}</p>
                        <PlanBadge status={plan.status} />
                        {plan.currentCycle ? <PaymentBadge status={plan.currentCycle.status} /> : null}
                      </div>
                      <p className="mt-1 text-sm font-bold text-muted">
                        {plan.planName} {plan.serviceName ? `- ${plan.serviceName}` : ""}
                      </p>
                      <p className="mt-2 text-sm font-medium text-muted">
                        {billingLabels[plan.billingType]} - {recurrenceLabels[plan.recurrenceType]} - {plan.sessionsPerMonth}x/mes
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <div className="rounded-lg bg-white px-3 py-2">
                          <p className="text-[11px] font-black uppercase text-muted">Sessoes</p>
                          <p className="text-sm font-black text-ink">{plan.monthSessions || 0} no mes</p>
                        </div>
                        <div className="rounded-lg bg-white px-3 py-2">
                          <p className="text-[11px] font-black uppercase text-muted">Concluidas</p>
                          <p className="text-sm font-black text-success">{plan.completedSessions || 0}</p>
                        </div>
                        <div className="rounded-lg bg-white px-3 py-2">
                          <p className="text-[11px] font-black uppercase text-muted">Valor</p>
                          <p className="text-sm font-black text-ink">
                            {money(plan.billingType === "per_completed_session" ? plan.sessionPrice || plan.amount : plan.monthlyPrice || plan.amount)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button className="col-span-2" onClick={() => openDetail(plan, "summary")}>
                        Ver detalhes
                      </Button>
                      <Button variant="secondary" onClick={() => startEdit(plan)}>
                        Editar
                      </Button>
                      <Button variant="secondary" onClick={() => generateAgenda(plan)} disabled={!plan.serviceId || !plan.professionalId}>
                        Gerar agenda
                      </Button>
                      {plan.currentCycle ? (
                        <Button
                          className="col-span-2"
                          variant={plan.currentCycle.status === "paid" ? "secondary" : "success"}
                          disabled={plan.status === "canceled"}
                          onClick={() => quickMarkPayment(plan, plan.currentCycle.status === "paid" ? "pending" : "paid")}
                        >
                          {plan.currentCycle.status === "paid" ? "Voltar pendente" : "Marcar como pago"}
                        </Button>
                      ) : (
                        <Button className="col-span-2" variant="secondary" onClick={() => openDetail(plan, "sessions")}>
                          Ver sessoes
                        </Button>
                      )}
                      <Button variant="secondary" onClick={() => openDetail(plan, "payments")}>
                        Pagamentos
                      </Button>
                      <Button variant="danger" disabled={plan.status === "canceled"} onClick={() => setPendingCancel(plan)}>
                        Cancelar
                      </Button>
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState title="Nenhum mensalista cadastrado" description="Crie um plano recorrente para gerar agenda e controlar pagamentos." />
              )}
            </div>
          </Card>
        </div>
      </section>

      <PlanDetailModal
        plan={detailPlan}
        activeTab={detailTab}
        onTabChange={setDetailTab}
        onClose={() => {
          setDetailPlan(null);
          navigate("/mensalidades", { replace: true });
        }}
        onEdit={(plan) => {
          startEdit(plan);
          setDetailPlan(null);
          navigate("/mensalidades", { replace: true });
        }}
        onGenerate={generateAgenda}
        onPayment={(plan, cycle) => setPaymentTarget({ plan, cycle })}
        onUpdateSession={updateSession}
      />

      <PaymentModal
        open={Boolean(paymentTarget)}
        plan={paymentTarget?.plan}
        cycle={paymentTarget?.cycle}
        saving={paymentSaving}
        onClose={() => setPaymentTarget(null)}
        onSubmit={savePayment}
      />

      <QuickCreateModal
        open={quickClientOpen}
        title="Novo cliente"
        description="Cadastre sem sair da mensalidade."
        saving={quickSaving}
        onSubmit={createQuickClient}
        onClose={() => setQuickClientOpen(false)}
      >
        <Field label="Nome">
          <input required minLength={2} value={quickClientForm.name} onChange={(event) => setQuickClientForm((current) => ({ ...current, name: event.target.value }))} className={inputClass} placeholder="Nome do cliente" />
        </Field>
        <Field label="Telefone">
          <input value={quickClientForm.phone} onChange={(event) => setQuickClientForm((current) => ({ ...current, phone: event.target.value }))} className={inputClass} placeholder="(00) 00000-0000" />
        </Field>
        <Field label="Observacoes">
          <textarea value={quickClientForm.notes} onChange={(event) => setQuickClientForm((current) => ({ ...current, notes: event.target.value }))} className={`${inputClass} min-h-24 resize-none`} />
        </Field>
      </QuickCreateModal>

      <ConfirmDialog
        open={Boolean(pendingCancel)}
        title="Cancelar mensalidade?"
        description={pendingCancel ? `${pendingCancel.planName} sera cancelada para os proximos meses.` : ""}
        confirmLabel="Cancelar"
        danger
        onConfirm={confirmCancel}
        onCancel={() => setPendingCancel(null)}
      />
    </div>
  );
}
