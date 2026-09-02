import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client.js";
import Button from "../components/Button.jsx";
import Card, { CardHeader } from "../components/Card.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Field, { inputClass } from "../components/Field.jsx";
import Icon from "../components/Icon.jsx";
import Loading from "../components/Loading.jsx";
import Message from "../components/Message.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useToast } from "../components/Toast.jsx";
import { PLAN_SLUGS, PLANS_CONFIG } from "../config/plans.js";

const platformEventLabels = {
  "platform.access": "Acesso ao painel",
  "platform.workspace_status_changed": "Status da conta alterado",
  "platform.workspace_plan_changed": "Plano alterado",
  "platform.workspace_deleted": "Conta excluida",
  "platform.user_status_changed": "Status do usuario alterado",
  "cron.reminders_processed": "Lembretes processados"
};

function auditEventLabel(type) {
  return platformEventLabels[type] || type;
}

const metricIcons = {
  "Total de assinantes": "clients",
  "Assinaturas ativas": "check",
  "Vencidas/inadimplentes": "bell",
  "Contas em teste": "history",
  "MRR estimado": "finance",
  "Workspaces/contas": "building",
  Usuarios: "user",
  Profissionais: "professionals",
  Admins: "settings",
  "Agendamentos no periodo": "appointments",
  "Movimentado por assinantes": "sales",
  "Faturamento bruto": "finance",
  "Despesas registradas": "expenses",
  "Liquido estimado": "finance"
};

function timeAgoLabel(dateValue) {
  if (!dateValue) return null;
  const minutes = Math.floor((Date.now() - new Date(dateValue).getTime()) / 60000);
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `${minutes} min atras`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atras`;
  return `${Math.floor(hours / 24)}d atras`;
}

function daysUntil(dateValue) {
  if (!dateValue) return null;
  return Math.ceil((new Date(dateValue).getTime() - Date.now()) / 86400000);
}

function attentionReason(row) {
  if (row.subscriptionStatus === "blocked") return { label: "Bloqueada", tone: "bg-red-50 text-red-700 ring-red-200" };
  if (row.subscriptionStatus === "past_due") return { label: "Pagamento atrasado", tone: "bg-amber-50 text-amber-700 ring-amber-200" };
  if (row.subscriptionStatus === "canceled") return { label: "Cancelada", tone: "bg-slate-100 text-slate-700 ring-slate-200" };
  if (row.status && row.status !== "active") return { label: "Conta inativa", tone: "bg-red-50 text-red-700 ring-red-200" };
  const days = daysUntil(row.subscriptionPaidUntil);
  if (days !== null && days <= 3) {
    return { label: days <= 0 ? "Vencendo hoje" : `Vence em ${days} dia(s)`, tone: "bg-amber-50 text-amber-700 ring-amber-200" };
  }
  return { label: "Atencao", tone: "bg-amber-50 text-amber-700 ring-amber-200" };
}

function isAttentionRow(row) {
  if (["blocked", "past_due", "canceled"].includes(row.subscriptionStatus)) return true;
  if (row.status && row.status !== "active") return true;
  if (["trialing", "trial"].includes(row.subscriptionStatus)) {
    const days = daysUntil(row.subscriptionPaidUntil);
    return days !== null && days <= 3;
  }
  return false;
}

const periodOptions = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "Ultimos 7 dias" },
  { value: "month", label: "Este mes" },
  { value: "last_month", label: "Mes passado" },
  { value: "custom", label: "Personalizado" }
];

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const integer = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

function todayString() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatValue(value, type) {
  if (type === "money") return money.format(Number(value || 0));
  return integer.format(Number(value || 0));
}

function periodParams(filters) {
  const params = { period: filters.period };
  if (filters.period === "custom") {
    params.startDate = filters.startDate;
    params.endDate = filters.endDate;
  }
  return params;
}

function normalizeSection(section) {
  if (section === "contas" || section === "planos" || section === "auditoria" || section === "suporte") return section;
  return "dashboard";
}

function MetricCard({ label, value, type = "number", tone = "blue" }) {
  const tones = {
    blue: { grad: "from-blue-600 to-sky-500", chip: "bg-blue-50 text-blue-700" },
    green: { grad: "from-emerald-600 to-teal-500", chip: "bg-emerald-50 text-emerald-700" },
    amber: { grad: "from-amber-500 to-orange-500", chip: "bg-amber-50 text-amber-700" },
    slate: { grad: "from-slate-800 to-slate-600", chip: "bg-slate-100 text-slate-700" }
  };
  const palette = tones[tone] || tones.blue;
  const icon = metricIcons[label];

  return (
    <article className="min-w-0 rounded-2xl border border-white/70 bg-white p-4 shadow-[0_20px_55px_rgba(15,23,42,0.08)] sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className={`h-1.5 w-16 rounded-full bg-gradient-to-r ${palette.grad}`} />
        {icon ? (
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${palette.chip}`}>
            <Icon name={icon} className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-xs font-black uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{formatValue(value, type)}</p>
    </article>
  );
}

function SystemHealthCard({ lastCronRun }) {
  const minutesAgo = lastCronRun?.lastRunAt
    ? Math.floor((Date.now() - new Date(lastCronRun.lastRunAt).getTime()) / 60000)
    : null;
  const state = !lastCronRun
    ? {
        label: "Nunca rodou",
        className: "bg-red-50 text-red-700 ring-red-200",
        detail: "O job de lembretes de agendamento ainda nao foi executado nenhuma vez."
      }
    : minutesAgo > 20
    ? {
        label: "Atrasado",
        className: "bg-amber-50 text-amber-700 ring-amber-200",
        detail: `Ultima execucao ha ${timeAgoLabel(lastCronRun.lastRunAt)} - o esperado e a cada 5 minutos.`
      }
    : {
        label: "Em dia",
        className: "bg-green-50 text-success ring-green-200",
        detail: `Ultima execucao ha ${timeAgoLabel(lastCronRun.lastRunAt)}.`
      };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Lembretes de agendamento (cron)</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">{state.label}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-600">{state.detail}</p>
          {lastCronRun ? (
            <p className="mt-1 text-xs font-bold text-slate-500">
              {lastCronRun.sent} enviado(s) - {lastCronRun.failed} falha(s) na ultima execucao
            </p>
          ) : null}
        </div>
        <span className={`inline-flex w-fit shrink-0 rounded-full px-3 py-1.5 text-xs font-black ring-1 ${state.className}`}>
          {state.label}
        </span>
      </div>
    </Card>
  );
}

function AttentionAccounts({ rows, onSelect }) {
  if (!rows.length) return null;

  return (
    <Card>
      <CardHeader
        title="Contas que precisam de atencao"
        description="Pagamento atrasado, bloqueadas, inativas ou com teste acabando nos proximos dias."
      />
      <div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => {
          const reason = attentionReason(row);
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelect(row)}
              className="flex flex-col items-start gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-blue-300 hover:bg-blue-50"
            >
              <span className={`rounded-full px-2.5 py-1 text-xs font-black ring-1 ${reason.tone}`}>{reason.label}</span>
              <span className="mt-1 w-full truncate text-sm font-black text-slate-950">{row.name}</span>
              <span className="w-full truncate text-xs font-semibold text-slate-500">{row.ownerEmail}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function BarList({ title, items = [], type = "number", empty = "Sem dados para este periodo." }) {
  const max = Math.max(...items.map((item) => Number(item.value || 0)), 0);

  return (
    <Card className="rounded-2xl">
      <CardHeader title={title} />
      <div className="space-y-3 p-4">
        {items.length ? (
          items.map((item) => {
            const width = max ? `${Math.max(6, (Number(item.value || 0) / max) * 100)}%` : "6%";
            return (
              <div key={item.label} className="min-w-0">
                <div className="mb-1 flex items-center justify-between gap-3 text-xs font-black text-slate-600">
                  <span className="truncate">{item.label}</span>
                  <span className="shrink-0 text-slate-950">{formatValue(item.value, type)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500" style={{ width }} />
                </div>
              </div>
            );
          })
        ) : (
          <EmptyState title="Nada para comparar ainda" description={empty} />
        )}
      </div>
    </Card>
  );
}

function PeriodFilters({ filters, onChange }) {
  return (
    <Card className="rounded-2xl">
      <div className="grid gap-3 p-4 lg:grid-cols-[1.2fr_1fr_1fr]">
        <Field label="Periodo">
          <select className={inputClass} value={filters.period} onChange={(event) => onChange({ ...filters, period: event.target.value })}>
            {periodOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Data inicial">
          <input
            className={inputClass}
            type="date"
            value={filters.startDate}
            disabled={filters.period !== "custom"}
            onChange={(event) => onChange({ ...filters, startDate: event.target.value })}
          />
        </Field>
        <Field label="Data final">
          <input
            className={inputClass}
            type="date"
            value={filters.endDate}
            disabled={filters.period !== "custom"}
            onChange={(event) => onChange({ ...filters, endDate: event.target.value })}
          />
        </Field>
      </div>
    </Card>
  );
}

function ComparisonTable({ rows, filters, onFiltersChange, onSelect, selectedId }) {
  const plans = useMemo(() => [...new Set(rows.map((row) => row.plan).filter(Boolean))].sort(), [rows]);

  return (
    <Card>
      <CardHeader
        title="Comparativo de contas"
        description="Compare assinantes por plano, status, equipe, agendamentos e movimentacao financeira."
      />
      <div className="grid gap-3 border-b border-slate-100 p-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <Field label="Busca">
          <input
            className={inputClass}
            placeholder="Nome, conta ou email"
            value={filters.search}
            onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
          />
        </Field>
        <Field label="Plano">
          <select className={inputClass} value={filters.plan} onChange={(event) => onFiltersChange({ ...filters, plan: event.target.value })}>
            <option value="">Todos</option>
            {plans.map((plan) => <option key={plan} value={plan}>{plan}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select className={inputClass} value={filters.status} onChange={(event) => onFiltersChange({ ...filters, status: event.target.value })}>
            <option value="">Todos</option>
            <option value="ACTIVE">Ativo</option>
            <option value="TRIALING">Teste</option>
            <option value="PAST_DUE">Inadimplente</option>
            <option value="BLOCKED">Bloqueado</option>
            <option value="CANCELED">Cancelado</option>
            <option value="MANUAL_UNLOCKED">Liberado manualmente</option>
          </select>
        </Field>
        <Field label="Ordenar por">
          <select className={inputClass} value={filters.sort} onChange={(event) => onFiltersChange({ ...filters, sort: event.target.value })}>
            <option value="revenue">Faturamento</option>
            <option value="users">Usuarios</option>
            <option value="professionals">Profissionais</option>
            <option value="appointments">Agendamentos</option>
            <option value="createdAt">Criacao</option>
          </select>
        </Field>
        <Field label="Direcao">
          <select className={inputClass} value={filters.direction} onChange={(event) => onFiltersChange({ ...filters, direction: event.target.value })}>
            <option value="desc">Maior primeiro</option>
            <option value="asc">Menor primeiro</option>
          </select>
        </Field>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1120px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Conta</th>
              <th className="px-4 py-3">Dono</th>
              <th className="px-4 py-3">Plano</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Usuarios</th>
              <th className="px-4 py-3 text-right">Profissionais</th>
              <th className="px-4 py-3 text-right">Admins</th>
              <th className="px-4 py-3 text-right">Agend.</th>
              <th className="px-4 py-3 text-right">Faturamento</th>
              <th className="px-4 py-3 text-right">Despesas</th>
              <th className="px-4 py-3 text-right">Liquido</th>
              <th className="px-4 py-3">Criacao</th>
              <th className="px-4 py-3">Ultima atividade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr
                key={row.id}
                className={`cursor-pointer transition hover:bg-blue-50/70 ${selectedId === row.id ? "bg-blue-50" : "bg-white"}`}
                onClick={() => onSelect(row)}
              >
                <td className="px-4 py-3 font-black text-slate-950">{row.name}</td>
                <td className="px-4 py-3">
                  <p className="font-bold text-slate-800">{row.ownerName}</p>
                  <p className="text-xs text-slate-500">{row.ownerEmail}</p>
                </td>
                <td className="px-4 py-3 font-bold text-slate-700">{row.plan}</td>
                <td className="px-4 py-3"><StatusBadge status={row.subscriptionStatus} /></td>
                <td className="px-4 py-3 text-right font-bold">{row.counts.users}</td>
                <td className="px-4 py-3 text-right font-bold">{row.counts.professionals}</td>
                <td className="px-4 py-3 text-right font-bold">{row.counts.admins}</td>
                <td className="px-4 py-3 text-right font-bold">{row.counts.appointments}</td>
                <td className="px-4 py-3 text-right font-black">{money.format(row.financial.gross)}</td>
                <td className="px-4 py-3 text-right font-bold text-red-600">{money.format(row.financial.expenses)}</td>
                <td className="px-4 py-3 text-right font-black text-emerald-700">{money.format(row.financial.net)}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(row.createdAt)}</td>
                <td className="px-4 py-3 text-slate-600">{formatDateTime(row.lastActivityAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length ? <EmptyState title="Nenhuma conta encontrada" description="Ajuste os filtros ou aguarde os primeiros assinantes entrarem." /> : null}
    </Card>
  );
}

function ActionPanel({ workspace, onRefresh }) {
  const { showToast } = useToast();
  const [reason, setReason] = useState("");
  const [plan, setPlan] = useState("");
  const [busy, setBusy] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => {
    setPlan(workspace?.plan || "");
    setReason("");
    setDetail(null);
    setPendingAction(null);
  }, [workspace?.id]);

  function runAction(key, label, handler) {
    if (!workspace) return;
    if (reason.trim().length < 5) {
      showToast("Informe um motivo antes da acao sensivel.", "error");
      return;
    }
    setPendingAction({ key, label, handler, reason: reason.trim(), workspaceName: workspace.name });
  }

  async function confirmPendingAction() {
    if (!pendingAction) return;
    setBusy(pendingAction.key);
    try {
      await pendingAction.handler();
      showToast("Acao registrada com auditoria.");
      setPendingAction(null);
      await onRefresh?.();
    } catch (error) {
      showToast(error?.message || "Nao foi possivel executar a acao.", "error");
    } finally {
      setBusy("");
    }
  }

  async function loadDetails() {
    if (!workspace) return;
    setDetailLoading(true);
    try {
      setDetail(await api.getPlatformWorkspace(workspace.id));
    } catch (error) {
      showToast(error?.message || "Nao foi possivel carregar detalhes.", "error");
    } finally {
      setDetailLoading(false);
    }
  }

  if (!workspace) {
    return (
      <Card>
        <CardHeader title="Controles administrativos" description="Selecione uma conta no comparativo para liberar acoes sensiveis." />
        <EmptyState title="Nenhuma conta selecionada" description="As acoes aparecem aqui com confirmacao e motivo obrigatorio." />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Controles administrativos"
        description="Acoes sensiveis exigem confirmacao, motivo e registro de auditoria."
      />
      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_1.2fr]">
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase text-slate-500">Conta selecionada</p>
          <h3 className="text-xl font-black text-slate-950">{workspace.name}</h3>
          <p className="text-sm font-semibold text-slate-600">{workspace.ownerEmail}</p>
          <div className="grid grid-cols-2 gap-2 text-sm font-bold text-slate-700">
            <span>Plano: {workspace.plan}</span>
            <span>Status: {workspace.subscriptionStatus}</span>
            <span>Profissionais: {workspace.counts.professionals}</span>
            <span>Agendamentos: {workspace.counts.appointments}</span>
          </div>
          <Field label="Motivo da acao">
            <textarea
              className={`${inputClass} min-h-28`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ex.: ajuste solicitado pelo suporte apos validacao do pagamento"
            />
          </Field>
          <Field label="Plano manual">
            <select className={inputClass} value={plan} onChange={(event) => setPlan(event.target.value)}>
              {Object.values(PLANS_CONFIG).map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.displayName} - R$ {item.price.toFixed(2).replace(".", ",")}
                </option>
              ))}
            </select>
          </Field>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <Button variant="secondary" onClick={loadDetails} loading={detailLoading} loadingLabel="Carregando...">Visualizar detalhes</Button>
          <Button
            variant="secondary"
            loading={busy === "plan"}
            onClick={() =>
              runAction(
                "plan",
                plan === PLAN_SLUGS.PADRAO
                  ? "Alterar para Padrao, inativar contas afiliadas e consolidar os dados no owner"
                  : "Alterar plano manualmente",
                () => api.updatePlatformWorkspacePlan(workspace.id, { plan, reason })
              )
            }
          >
            Alterar plano
          </Button>
          <Button
            variant="success"
            loading={busy === "paid"}
            onClick={() => runAction("paid", "Marcar pagamento como pago", () => api.updatePlatformWorkspaceStatus(workspace.id, { subscriptionStatus: "ACTIVE", reason }))}
          >
            Marcar como pago
          </Button>
          <Button
            variant="secondary"
            loading={busy === "temp"}
            onClick={() => {
              const until = new Date();
              until.setDate(until.getDate() + 7);
              return runAction("temp", "Liberar acesso temporario por 7 dias", () =>
                api.updatePlatformWorkspaceStatus(workspace.id, { accountStatus: "ACTIVE", subscriptionStatus: "MANUAL_UNLOCKED", temporaryAccessUntil: until.toISOString(), reason })
              );
            }}
          >
            Liberar acesso temporario
          </Button>
          <Button
            variant="danger"
            loading={busy === "inactive"}
            onClick={() => runAction("inactive", "Inativar conta", () => api.updatePlatformWorkspaceStatus(workspace.id, { accountStatus: "INACTIVE", reason }))}
          >
            Inativar conta
          </Button>
          <Button
            variant="danger"
            loading={busy === "block"}
            onClick={() => runAction("block", "Bloquear conta", () => api.updatePlatformWorkspaceStatus(workspace.id, { accountStatus: "BLOCKED", reason }))}
          >
            Bloquear conta
          </Button>
          <Button
            variant="success"
            loading={busy === "unlock"}
            onClick={() => runAction("unlock", "Desbloquear conta", () => api.updatePlatformWorkspaceStatus(workspace.id, { accountStatus: "ACTIVE", reason }))}
          >
            Desbloquear conta
          </Button>
          <Button
            variant="danger"
            loading={busy === "user"}
            onClick={() => runAction("user", "Inativar usuario dono", () => api.updatePlatformUserStatus(workspace.id, { status: "INACTIVE", reason }))}
          >
            Inativar usuario
          </Button>
          <Button
            variant="danger"
            loading={busy === "delete"}
            onClick={() =>
              runAction(
                "delete",
                "Excluir conta definitivamente do banco de dados",
                () => api.deletePlatformWorkspace(workspace.id, { reason })
              )
            }
          >
            Excluir definitivo
          </Button>
        </section>
      </div>

      {detail ? (
        <div className="grid gap-4 border-t border-slate-100 p-4 lg:grid-cols-2">
          <div>
            <h4 className="text-sm font-black uppercase text-slate-500">Usuarios da conta</h4>
            <div className="mt-3 space-y-2">
              {detail.users?.map((user) => (
                <div key={user.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="font-black text-slate-950">{user.name}</p>
                  <p className="text-sm text-slate-500">{user.email} · {user.workspaceRole} · {user.userStatus}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-black uppercase text-slate-500">Profissionais da conta</h4>
            <div className="mt-3 space-y-2">
              {detail.professionals?.length ? detail.professionals.map((professional) => (
                <div key={professional.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="font-black text-slate-950">{professional.name}</p>
                  <p className="text-sm text-slate-500">{professional.role || "Sem cargo"} · {professional.isActive ? "ativo" : "inativo"}</p>
                </div>
              )) : <p className="text-sm font-semibold text-slate-500">Nenhum profissional cadastrado.</p>}
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title="Confirmar acao sensivel?"
        description={
          pendingAction
            ? `${pendingAction.label}. Conta: ${pendingAction.workspaceName}. Motivo: ${pendingAction.reason}.`
            : ""
        }
        confirmLabel="Confirmar"
        danger
        onConfirm={confirmPendingAction}
        onCancel={() => setPendingAction(null)}
      />
    </Card>
  );
}

export default function PlatformDashboard() {
  const { section } = useParams();
  const activeSection = normalizeSection(section);
  const [filters, setFilters] = useState({ period: "month", startDate: todayString(), endDate: todayString() });
  const [tableFilters, setTableFilters] = useState({ search: "", plan: "", status: "", sort: "revenue", direction: "desc" });
  const [overview, setOverview] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditEventType, setAuditEventType] = useState("");

  const query = useMemo(() => ({ ...periodParams(filters), ...tableFilters }), [filters, tableFilters]);
  const attentionRows = useMemo(() => workspaces.filter(isAttentionRow), [workspaces]);

  function selectWorkspaceAndScroll(row) {
    setSelectedWorkspace(row);
    document.getElementById("platform-action-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [overviewData, workspaceRows] = await Promise.all([
        api.platformOverview(periodParams(filters)),
        api.listPlatformWorkspaces(query)
      ]);
      setOverview(overviewData);
      setWorkspaces(workspaceRows);
      setSelectedWorkspace((current) => workspaceRows.find((row) => row.id === current?.id) || workspaceRows[0] || null);
    } catch (loadError) {
      setError(loadError?.message || "Nao foi possivel carregar o painel da plataforma.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [query.period, query.startDate, query.endDate, query.search, query.plan, query.status, query.sort, query.direction]);

  useEffect(() => {
    if (activeSection !== "auditoria") return undefined;
    let cancelled = false;
    setAuditLoading(true);
    api
      .listPlatformAuditLogs({ eventType: auditEventType })
      .then((logs) => {
        if (!cancelled) setAuditLogs(logs);
      })
      .catch(() => {
        if (!cancelled) setAuditLogs([]);
      })
      .finally(() => {
        if (!cancelled) setAuditLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSection, auditEventType]);

  const summary = overview?.summary || {};
  const charts = overview?.charts || {};

  if (loading && !overview) return <Loading label="Carregando painel da plataforma..." />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Painel da plataforma"
        description="Visao do dono do SaaS: assinantes, movimentacao, contas, auditoria e controles sensiveis separados do painel de cliente."
      />

      {error ? <Message type="error" title="Erro ao carregar" description={error} /> : null}

      <SystemHealthCard lastCronRun={overview?.lastCronRun} />

      {(activeSection === "dashboard" || activeSection === "contas") && attentionRows.length ? (
        <AttentionAccounts rows={attentionRows} onSelect={selectWorkspaceAndScroll} />
      ) : null}

      <PeriodFilters filters={filters} onChange={setFilters} />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total de assinantes" value={summary.totalSubscribers} />
        <MetricCard label="Assinaturas ativas" value={summary.activeSubscriptions} tone="green" />
        <MetricCard label="Vencidas/inadimplentes" value={summary.overdueSubscriptions} tone="amber" />
        <MetricCard label="Contas em teste" value={summary.trialAccounts} />
        <MetricCard label="MRR estimado" value={summary.estimatedMrr} type="money" tone="green" />
        <MetricCard label="Workspaces/contas" value={summary.totalWorkspaces} />
        <MetricCard label="Usuarios" value={summary.totalUsers} />
        <MetricCard label="Profissionais" value={summary.totalProfessionals} />
        <MetricCard label="Admins" value={summary.totalAdmins} />
        <MetricCard label="Agendamentos no periodo" value={summary.appointmentsInPeriod} />
        <MetricCard label="Movimentado por assinantes" value={summary.totalMovedBySubscribers} type="money" tone="slate" />
        <MetricCard label="Faturamento bruto" value={summary.grossRevenueMoved} type="money" tone="green" />
        <MetricCard label="Despesas registradas" value={summary.expensesRegistered} type="money" tone="amber" />
        <MetricCard label="Liquido estimado" value={summary.estimatedNetMoved} type="money" tone="green" />
      </section>

      {activeSection === "dashboard" || activeSection === "planos" ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <BarList title="Assinantes por plano" items={charts.subscribersByPlan || []} />
          <BarList title="Receita estimada por plano" items={charts.estimatedRevenueByPlan || []} type="money" />
          <BarList title="Crescimento de assinantes" items={charts.subscriberGrowth || []} />
          <BarList title="Movimentacao financeira por conta" items={charts.financialMovement || []} type="money" />
        </section>
      ) : null}

      {activeSection === "dashboard" || activeSection === "contas" ? (
        <section className="grid gap-4 lg:grid-cols-3">
          <BarList title="Profissionais por conta" items={charts.professionalsByAccount || []} />
          <BarList title="Usuarios por conta" items={charts.usersByAccount || []} />
          <BarList title="Top contas por dinheiro movimentado" items={(charts.topRevenueAccounts || []).map((row) => ({ label: row.name, value: row.financial.gross }))} type="money" />
          <BarList title="Top contas com mais profissionais" items={(charts.topProfessionalAccounts || []).map((row) => ({ label: row.name, value: row.counts.professionals }))} />
          <BarList title="Top contas com mais agendamentos" items={(charts.topAppointmentAccounts || []).map((row) => ({ label: row.name, value: row.counts.appointments }))} />
        </section>
      ) : null}

      <ComparisonTable
        rows={workspaces}
        filters={tableFilters}
        onFiltersChange={setTableFilters}
        onSelect={selectWorkspaceAndScroll}
        selectedId={selectedWorkspace?.id}
      />

      {(activeSection === "dashboard" || activeSection === "suporte" || activeSection === "contas") ? (
        <div id="platform-action-panel">
          <ActionPanel workspace={selectedWorkspace} onRefresh={loadData} />
        </div>
      ) : null}

      {activeSection === "auditoria" ? (
        <Card className="overflow-hidden">
          <CardHeader
            title="Auditoria de acoes sensiveis"
            description="Registro de tudo que foi alterado por aqui: status de conta, plano, exclusoes e a saude do cron de lembretes."
          />
          <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-4">
            <Field label="Evento">
              <select className={inputClass} value={auditEventType} onChange={(event) => setAuditEventType(event.target.value)}>
                <option value="">Acoes administrativas (padrao)</option>
                <option value="platform.access">Acessos ao painel</option>
                {Object.entries(platformEventLabels)
                  .filter(([key]) => key !== "platform.access")
                  .map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
              </select>
            </Field>
          </div>

          {auditLoading ? (
            <div className="p-6">
              <Loading label="Carregando auditoria..." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[860px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Quando</th>
                    <th className="px-4 py-3">Evento</th>
                    <th className="px-4 py-3">Operador</th>
                    <th className="px-4 py-3">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="bg-white align-top">
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-600">{formatDateTime(log.createdAt)}</td>
                      <td className="px-4 py-3 font-black text-slate-950">{auditEventLabel(log.eventType)}</td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-800">{log.userName || "Sistema"}</p>
                        <p className="text-xs text-slate-500">{log.email || "-"}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {log.message || "-"}
                        {log.metadata?.targetEmail ? (
                          <p className="mt-1 text-xs font-semibold text-slate-500">Conta: {log.metadata.targetEmail}</p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!auditLoading && !auditLogs.length ? (
            <EmptyState
              title="Nenhum evento encontrado"
              description="As acoes sensiveis e a saude do cron aparecerao aqui conforme forem acontecendo."
            />
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
