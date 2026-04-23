import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import Button from "../components/Button.jsx";
import Card, { CardHeader } from "../components/Card.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Field, { inputClass } from "../components/Field.jsx";
import Loading from "../components/Loading.jsx";
import Message from "../components/Message.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useToast } from "../components/Toast.jsx";
import {
  cancelSubscription,
  createSubscription,
  listSubscriptionCycles,
  listSubscriptions,
  markSubscriptionPayment,
  subscriptionStatusLabel,
  subscriptionSummary,
  sumExpectedSubscriptionCycles,
  sumPaidSubscriptionCycles,
  updateSubscription
} from "../services/subscriptions.js";
import { money, todayInputValue } from "../utils.js";

const emptyForm = {
  clientId: "",
  planName: "",
  amount: "",
  dueDay: "10",
  startDate: todayInputValue(),
  status: "active",
  notes: ""
};

function QuickCreateModal({ open, title, description, children, saving, onSubmit, onClose }) {
  if (!open) return null;

  return (
    <div className="agensync-overlay z-50 flex items-end bg-slate-950/45 p-3 sm:items-center sm:justify-center">
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

function SummaryCard({ label, value, helper, tone = "ink" }) {
  const toneClass = tone === "red" ? "text-red-600" : tone === "green" ? "text-success" : tone === "blue" ? "text-brand" : "text-ink";

  return (
    <article className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-soft">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className={`mt-2 text-3xl font-black tracking-tight ${toneClass}`}>{value}</p>
      {helper ? <p className="mt-2 text-sm font-bold text-muted">{helper}</p> : null}
    </article>
  );
}

export default function Subscriptions() {
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState("");
  const [pendingCancel, setPendingCancel] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [summary, setSummary] = useState({ activeCount: 0, pending: 0, overdue: 0, cycles: [] });
  const [historyCycles, setHistoryCycles] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [quickClientForm, setQuickClientForm] = useState({ name: "", phone: "", notes: "" });
  const [quickSaving, setQuickSaving] = useState(false);
  const [error, setError] = useState("");
  const { showToast } = useToast();
  const currentMonth = monthKey();

  useEffect(() => {
    let active = true;
    api
      .listClients()
      .then((clientsData) => {
        if (!active) return;
        setClients(clientsData.clients);
      })
      .catch((err) => {
        if (!active) return;
        setClients([]);
        setError(err.message);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    Promise.all([listSubscriptions({ month: currentMonth }), subscriptionSummary({ month: currentMonth })])
      .then(([monthlySubscriptions, monthlySummary]) => {
        if (!active) return;
        setSubscriptions(monthlySubscriptions);
        setSummary(monthlySummary);
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
  }, [currentMonth, refreshKey, reloadKey]);

  useEffect(() => {
    let active = true;

    if (!historyTarget) {
      setHistoryCycles([]);
      return () => {
        active = false;
      };
    }

    const startMonth = addMonths(currentMonth, -5);
    listSubscriptionCycles({
      startDate: monthStart(startMonth),
      endDate: monthEnd(currentMonth)
    })
      .then((cycles) => {
        if (!active) return;
        setHistoryCycles(
          cycles
            .filter((cycle) => cycle.subscriptionId === historyTarget.id)
            .sort((first, second) => second.month.localeCompare(first.month))
        );
      })
      .catch((err) => {
        if (active) showToast(err.message, "error");
      });

    return () => {
      active = false;
    };
  }, [currentMonth, historyTarget, refreshKey, showToast]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function clientName(clientId) {
    return clients.find((client) => client.id === clientId)?.name || "Cliente";
  }

  function resetForm() {
    setEditing("");
    setForm(emptyForm);
  }

  function startEdit(subscription) {
    setEditing(subscription.id);
    setForm({
      clientId: subscription.clientId,
      planName: subscription.planName,
      amount: subscription.amount,
      dueDay: subscription.dueDay,
      startDate: subscription.startDate,
      status: subscription.status,
      notes: subscription.notes || ""
    });
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      const payload = {
        ...form,
        clientName: clientName(form.clientId)
      };

      if (editing) {
        await updateSubscription(editing, payload);
        showToast("Mensalidade atualizada.");
      } else {
        await createSubscription(payload);
        showToast("Mensalidade criada.");
      }

      setRefreshKey((current) => current + 1);
      resetForm();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
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

  async function markCycle(subscription, status) {
    if (!subscription.currentCycle) return;
    try {
      await markSubscriptionPayment(subscription.id, subscription.currentCycle.month, status);
      setRefreshKey((current) => current + 1);
      showToast(status === "paid" ? "Mensalidade marcada como paga." : "Mensalidade voltou para pendente.");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function markHistoryCycle(cycle, status) {
    try {
      await markSubscriptionPayment(cycle.subscriptionId, cycle.month, status);
      setRefreshKey((current) => current + 1);
      showToast(status === "paid" ? "Pagamento marcado como pago." : "Pagamento voltou para pendente.");
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
      showToast("Assinatura cancelada.");
      setPendingCancel(null);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  if (loading) return <Loading label="Carregando mensalidades..." />;

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Mensalidades"
        description="Controle clientes recorrentes, cobranças mensais, atrasos e recebimentos confirmados."
      />
      <Message type="error" actionLabel="Tentar novamente" onAction={() => setReloadKey((value) => value + 1)}>
        {error}
      </Message>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Ativas" value={summary.activeCount} helper="assinaturas em aberto" tone="blue" />
        <SummaryCard label="Pendentes" value={summary.pending} helper="cobranças do mês" />
        <SummaryCard label="Atrasadas" value={summary.overdue} helper="vencidas sem pagamento" tone="red" />
        <SummaryCard label="Previsto" value={money(sumExpectedSubscriptionCycles(summary.cycles))} helper={formatMonth(currentMonth)} />
        <SummaryCard label="Recebido" value={money(sumPaidSubscriptionCycles(summary.cycles))} helper="marcado como pago" tone="green" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)] xl:items-start">
        <Card as="form" onSubmit={handleSubmit} className="space-y-4 p-5 xl:sticky xl:top-8">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">
              {editing ? "Editar mensalidade" : "Nova mensalidade"}
            </p>
            <h2 className="mt-2 text-xl font-black tracking-tight text-ink">
              {editing ? "Atualizar assinatura" : "Cadastrar mensalista"}
            </h2>
            <p className="mt-1 text-sm font-medium leading-6 text-muted">
              Vincule um cliente a um plano mensal e acompanhe cada competência.
            </p>
          </div>

          <Field
            label={
              <span className="flex items-center justify-between gap-3">
                <span>Cliente</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2 text-[13px] font-black text-muted hover:text-brand"
                  onClick={() => setQuickClientOpen(true)}
                >
                  + Novo cliente
                </Button>
              </span>
            }
          >
            <select
              required
              value={form.clientId}
              onChange={(event) => updateForm("clientId", event.target.value)}
              className={inputClass}
            >
              <option value="">Selecione um cliente</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Nome do plano">
            <input
              required
              minLength={2}
              value={form.planName}
              onChange={(event) => updateForm("planName", event.target.value)}
              className={inputClass}
              placeholder="Ex: Manutenção mensal"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Field label="Valor mensal">
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(event) => updateForm("amount", event.target.value)}
                className={inputClass}
                placeholder="0,00"
              />
            </Field>
            <Field label="Dia de vencimento">
              <input
                required
                type="number"
                min="1"
                max="31"
                value={form.dueDay}
                onChange={(event) => updateForm("dueDay", event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Field label="Data de início">
              <input
                required
                type="date"
                value={form.startDate}
                onChange={(event) => updateForm("startDate", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Status da assinatura">
              <select value={form.status} onChange={(event) => updateForm("status", event.target.value)} className={inputClass}>
                <option value="active">Ativa</option>
                <option value="canceled">Cancelada</option>
              </select>
            </Field>
          </div>

          <Field label="Observações">
            <textarea
              value={form.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
              className={`${inputClass} min-h-24 resize-none`}
              placeholder="Inclui quais serviços, regras do plano ou observações do cliente"
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            {editing ? (
              <Button variant="secondary" onClick={resetForm}>
                Cancelar
              </Button>
            ) : null}
            <Button type="submit" className={editing ? "" : "col-span-2"}>
              {editing ? "Atualizar" : "Salvar mensalidade"}
            </Button>
          </div>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader title="Clientes mensalistas" description={`${subscriptions.length} assinatura(s) cadastrada(s)`} />
          <div className="compact-scroll-list divide-y divide-[#E2E8F0]">
            {subscriptions.length ? (
              subscriptions.map((subscription) => (
                <article
                  key={subscription.id}
                  className="grid gap-4 p-4 transition duration-200 hover:bg-[#F8FAFC] xl:grid-cols-[minmax(0,1fr)_minmax(260px,auto)] xl:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-black text-ink">{subscription.clientName}</p>
                      <PaymentBadge status={subscription.status === "canceled" ? "canceled" : subscription.currentCycle?.status || "pending"} />
                    </div>
                    <p className="mt-1 text-sm font-bold text-muted">{subscription.planName}</p>
                    <p className="mt-2 text-sm font-medium text-muted">
                      {money(subscription.amount)} · vence dia {subscription.dueDay}
                      {subscription.currentCycle ? ` · ${formatMonth(subscription.currentCycle.month)}` : ""}
                    </p>
                    {subscription.currentCycle?.paidAt ? (
                      <p className="mt-1 text-xs font-black text-success">Pago em {subscription.currentCycle.paidAt}</p>
                    ) : (
                      <p className="mt-1 text-xs font-black text-muted">
                        Última cobrança: {subscription.currentCycle?.dueDate || subscription.startDate}
                      </p>
                    )}
                    {subscription.notes ? <p className="mt-2 text-sm text-muted">{subscription.notes}</p> : null}
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
                    <Button
                      className="col-span-2 w-full sm:col-span-1 xl:col-span-2"
                      variant={subscription.currentCycle?.status === "paid" ? "secondary" : "success"}
                      disabled={subscription.status === "canceled" || !subscription.currentCycle}
                      onClick={() => markCycle(subscription, subscription.currentCycle?.status === "paid" ? "pending" : "paid")}
                    >
                      {subscription.currentCycle?.status === "paid" ? "Voltar pendente" : "Marcar como pago"}
                    </Button>
                    <Button variant="secondary" onClick={() => setHistoryTarget(subscription)}>
                      Histórico
                    </Button>
                    <Button variant="secondary" onClick={() => startEdit(subscription)}>
                      Editar
                    </Button>
                    <Button
                      variant="danger"
                      className="col-span-2"
                      disabled={subscription.status === "canceled"}
                      onClick={() => setPendingCancel(subscription)}
                    >
                      Cancelar assinatura
                    </Button>
                  </div>
                </article>
              ))
            ) : (
              <EmptyState title="Nenhuma mensalidade cadastrada" description="Crie um plano mensal para acompanhar clientes recorrentes." />
            )}
          </div>
        </Card>
      </section>

      {historyTarget ? (
        <div className="agensync-overlay z-50 flex items-end bg-slate-950/45 p-3 sm:items-center sm:justify-center">
          <div className="max-h-[90vh] w-full overflow-auto rounded-xl border border-[#E2E8F0] bg-white shadow-panel sm:max-w-3xl">
            <div className="flex flex-col gap-3 border-b border-[#E2E8F0] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.14em] text-brand">Histórico mensal</p>
                <h2 className="mt-1 text-xl font-black text-ink">{historyTarget.clientName}</h2>
                <p className="mt-1 text-sm text-muted">{historyTarget.planName}</p>
              </div>
              <Button variant="secondary" onClick={() => setHistoryTarget(null)}>
                Fechar
              </Button>
            </div>

            <div className="compact-scroll-list-sm divide-y divide-[#E2E8F0]">
              {historyCycles.length ? (
                historyCycles.map((cycle) => (
                  <article key={cycle.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-ink">{formatMonth(cycle.month)}</p>
                        <PaymentBadge status={cycle.status} />
                      </div>
                      <p className="mt-1 text-sm font-medium text-muted">
                        Vencimento {cycle.dueDate} · {money(cycle.amount)}
                      </p>
                      {cycle.paidAt ? <p className="mt-1 text-xs font-black text-success">Pago em {cycle.paidAt}</p> : null}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={cycle.status === "paid" ? "secondary" : "success"}
                        onClick={() => markHistoryCycle(cycle, cycle.status === "paid" ? "pending" : "paid")}
                      >
                        {cycle.status === "paid" ? "Pendente" : "Pago"}
                      </Button>
                      <Button variant="secondary" onClick={() => markHistoryCycle(cycle, "pending")}>
                        Pendente
                      </Button>
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState title="Sem histórico" description="Os ciclos aparecem a partir da data de início da mensalidade." />
              )}
            </div>
          </div>
        </div>
      ) : null}

      <QuickCreateModal
        open={quickClientOpen}
        title="Novo cliente"
        description="Cadastre sem sair da mensalidade."
        saving={quickSaving}
        onSubmit={createQuickClient}
        onClose={() => setQuickClientOpen(false)}
      >
        <Field label="Nome">
          <input
            required
            minLength={2}
            value={quickClientForm.name}
            onChange={(event) => setQuickClientForm((current) => ({ ...current, name: event.target.value }))}
            className={inputClass}
            placeholder="Nome do cliente"
          />
        </Field>
        <Field label="Telefone">
          <input
            value={quickClientForm.phone}
            onChange={(event) => setQuickClientForm((current) => ({ ...current, phone: event.target.value }))}
            className={inputClass}
            placeholder="(00) 00000-0000"
          />
        </Field>
        <Field label="Observacoes">
          <textarea
            value={quickClientForm.notes}
            onChange={(event) => setQuickClientForm((current) => ({ ...current, notes: event.target.value }))}
            className={`${inputClass} min-h-24 resize-none`}
            placeholder="Preferencias ou detalhes importantes"
          />
        </Field>
      </QuickCreateModal>

      <ConfirmDialog
        open={Boolean(pendingCancel)}
        title="Cancelar assinatura?"
        description={pendingCancel ? `${pendingCancel.planName} ficará cancelada para os próximos meses.` : ""}
        confirmLabel="Cancelar"
        danger
        onConfirm={confirmCancel}
        onCancel={() => setPendingCancel(null)}
      />
    </div>
  );
}
