import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import Button from "../components/Button.jsx";
import Card, { CardHeader } from "../components/Card.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import Field, { inputClass } from "../components/Field.jsx";
import Loading from "../components/Loading.jsx";
import Message from "../components/Message.jsx";
import PageHeader from "../components/PageHeader.jsx";

const eventLabels = {
  "auth.register": "Cadastro",
  "auth.login_success": "Login",
  "auth.login_failed": "Falha de login",
  "auth.logout": "Logout",
  "admin.access": "Acesso admin",
  "admin.role_changed": "Perfil alterado"
};

const statusOptions = [
  { value: "", label: "Todos" },
  { value: "active", label: "Ativos" },
  { value: "recent", label: "Recentes" },
  { value: "inactive", label: "Inativos" },
  { value: "none", label: "Sem atividade" }
];

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function normalizeRole(role) {
  return String(role || "user").trim().toLowerCase();
}

function roleBadge(role) {
  return normalizeRole(role) === "admin"
    ? "bg-blue-50 text-blue-700 ring-blue-200"
    : "bg-slate-100 text-slate-700 ring-slate-200";
}

function roleLabel(role) {
  return normalizeRole(role) === "admin" ? "Admin" : "Usuário";
}

function activityStatus(user) {
  if (!user.lastActivityAt) {
    return {
      key: "none",
      label: "Sem atividade",
      className: "bg-slate-100 text-slate-600 ring-slate-200"
    };
  }

  const days = Math.floor((Date.now() - new Date(user.lastActivityAt).getTime()) / 86400000);
  if (days <= 7) {
    return { key: "active", label: "Ativo", className: "bg-green-50 text-success ring-green-200" };
  }
  if (days <= 30) {
    return { key: "recent", label: "Recente", className: "bg-blue-50 text-blue-700 ring-blue-200" };
  }
  return { key: "inactive", label: "Inativo", className: "bg-amber-50 text-amber-700 ring-amber-200" };
}

function StatTile({ label, value, detail }) {
  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-2 truncate text-3xl font-black text-ink">{value}</p>
      {detail ? <p className="mt-1 text-sm font-semibold text-muted">{detail}</p> : null}
    </article>
  );
}

function SystemStatus({ summary }) {
  const failures = Number(summary?.loginFailures7Days || 0);
  const status =
    failures >= 10
      ? { label: "Atenção", className: "bg-amber-50 text-amber-700 ring-amber-200", detail: "Falhas de login elevadas nos últimos 7 dias." }
      : { label: "Operacional", className: "bg-green-50 text-success ring-green-200", detail: "Sem sinais críticos nas métricas administrativas." };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Status geral</p>
          <h2 className="mt-1 text-lg font-black text-ink">Sistema {status.label.toLowerCase()}</h2>
          <p className="mt-1 text-sm font-semibold text-muted">{status.detail}</p>
        </div>
        <span className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-black ring-1 ${status.className}`}>
          {status.label}
        </span>
      </div>
    </Card>
  );
}

function UserCard({ user, saving, onChangeRole }) {
  const status = activityStatus(user);
  const isAdmin = normalizeRole(user.role) === "admin";
  const nextRole = isAdmin ? "user" : "admin";

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-black text-ink">{user.name}</p>
          <p className="truncate text-sm font-semibold text-muted">{user.email}</p>
          <p className="mt-1 truncate text-xs font-semibold text-muted">{user.businessName || "-"}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ring-1 ${roleBadge(user.role)}`}>
          {roleLabel(user.role)}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-semibold text-muted">
        <span className="rounded-xl bg-slate-50 px-3 py-2">{user.counts?.clients || 0} clientes</span>
        <span className="rounded-xl bg-slate-50 px-3 py-2">{user.counts?.appointments || 0} agendamentos</span>
        <span className="rounded-xl bg-slate-50 px-3 py-2">{user.counts?.services || 0} serviços</span>
        <span className="rounded-xl bg-slate-50 px-3 py-2">{user.counts?.products || 0} produtos</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className={`rounded-full px-2.5 py-1 text-xs font-black ring-1 ${status.className}`}>{status.label}</span>
        <p className="text-xs font-semibold text-muted">Último login: {formatDateTime(user.lastLoginAt)}</p>
      </div>

      <Button
        size="sm"
        variant={isAdmin ? "secondary" : "primary"}
        className="mt-4 w-full"
        loading={saving}
        loadingLabel="Alterando..."
        onClick={() => onChangeRole(user, nextRole)}
      >
        {isAdmin ? "Remover admin" : "Conceder admin"}
      </Button>
    </article>
  );
}

function AuditCard({ log }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-black text-ink">{eventLabels[log.eventType] || log.eventType}</p>
          <p className="mt-1 text-xs font-semibold text-muted">{formatDateTime(log.createdAt)}</p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700 ring-1 ring-slate-200">
          {log.ipAddress || "-"}
        </span>
      </div>
      {log.message ? <p className="mt-3 text-sm font-semibold text-muted">{log.message}</p> : null}
      <div className="mt-3 min-w-0 text-xs font-semibold text-muted">
        <p className="truncate">{log.userName || "Sem usuário"} · {log.email || "-"}</p>
        <p className="mt-1 truncate">{log.route || "-"}</p>
      </div>
    </article>
  );
}

export default function Admin() {
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("");
  const [eventType, setEventType] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState("");
  const [pendingRoleChange, setPendingRoleChange] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load(filters = { search, roleFilter, eventType }) {
    setLoading(true);
    setError("");
    try {
      const [summaryData, usersData, logsData] = await Promise.all([
        api.adminSummary(),
        api.listAdminUsers({ take: 100, search: filters.search, role: filters.roleFilter }),
        api.listAdminAuditLogs({ take: 100, eventType: filters.eventType })
      ]);

      setSummary(summaryData);
      setUsers(usersData);
      setLogs(logsData);
    } catch (err) {
      setError(err.message || "Não foi possível carregar o painel admin.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load({ search: "", roleFilter: "all", eventType: "" });
  }, []);

  function applyFilters(event) {
    event.preventDefault();
    setSuccess("");
    load({ search: search.trim(), roleFilter, eventType });
  }

  function clearFilters() {
    setSearch("");
    setRoleFilter("all");
    setStatusFilter("");
    setEventType("");
    setSuccess("");
    load({ search: "", roleFilter: "all", eventType: "" });
  }

  function changeRole(user, nextRole) {
    if (normalizeRole(user.role) === nextRole) return;
    setPendingRoleChange({ user, nextRole });
  }

  async function confirmRoleChange() {
    if (!pendingRoleChange) return;
    const { user, nextRole } = pendingRoleChange;

    setSavingUserId(user.id);
    setPendingRoleChange(null);
    setError("");
    setSuccess("");
    try {
      const updated = await api.updateAdminUserRole(user.id, nextRole);
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      const [summaryData, logsData] = await Promise.all([
        api.adminSummary(),
        api.listAdminAuditLogs({ take: 100, eventType })
      ]);
      setSummary(summaryData);
      setLogs(logsData);
      setSuccess(`Perfil de ${updated.email} atualizado para ${roleLabel(updated.role)}.`);
    } catch (err) {
      setError(err.message || "Não foi possível alterar o perfil.");
    } finally {
      setSavingUserId("");
    }
  }

  const recordSummary = summary?.records || {};
  const topEvents = useMemo(() => summary?.events7Days || [], [summary]);
  const visibleUsers = useMemo(
    () => users.filter((user) => !statusFilter || activityStatus(user).key === statusFilter),
    [users, statusFilter]
  );
  const recentUsers = useMemo(() => [...users].slice(0, 5), [users]);

  if (loading && !summary) return <Loading label="Carregando painel admin..." />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Painel Admin"
        description="Controle de acesso, auditoria e indicadores administrativos do AgenSync."
      />

      <Message type="error" actionLabel="Tentar novamente" onAction={() => load({ search, roleFilter, eventType })}>
        {error}
      </Message>
      <Message type="success">{success}</Message>

      {summary ? (
        <>
          <SystemStatus summary={summary} />

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Usuários totais" value={summary.totalUsers || 0} detail={`${summary.newUsers30Days || 0} novos no mês`} />
            <StatTile label="Usuários ativos" value={summary.activeUsers30Days || 0} detail="Com atividade nos últimos 30 dias" />
            <StatTile label="Negócios" value={summary.businesses || 0} detail="Negócios cadastrados" />
            <StatTile label="Admins" value={summary.admins || 0} detail="Perfis administrativos" />
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <StatTile label="Clientes" value={recordSummary.clients || 0} />
            <StatTile label="Agendamentos" value={recordSummary.appointments || 0} />
            <StatTile label="Serviços" value={recordSummary.services || 0} />
            <StatTile label="Vendas" value={recordSummary.productSales || 0} />
            <StatTile label="Mensalidades" value={recordSummary.monthlyPlans || 0} />
            <StatTile label="Produtos" value={recordSummary.products || 0} />
          </section>
        </>
      ) : null}

      <Card as="form" onSubmit={applyFilters} className="p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_180px_180px_220px_auto_auto] xl:items-end">
          <Field label="Buscar usuário">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={inputClass}
              placeholder="Nome, email ou negócio"
            />
          </Field>
          <Field label="Perfil">
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className={inputClass}>
              <option value="all">Todos</option>
              <option value="user">Usuários</option>
              <option value="admin">Admins</option>
            </select>
          </Field>
          <Field label="Status">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass}>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Evento">
            <select value={eventType} onChange={(event) => setEventType(event.target.value)} className={inputClass}>
              <option value="">Todos</option>
              {Object.entries(eventLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit" loading={loading} loadingLabel="Filtrando...">Filtrar</Button>
          <Button variant="secondary" onClick={clearFilters}>Limpar</Button>
        </div>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <Card className="overflow-hidden">
          <CardHeader
            title="Tabela de usuários"
            description="Revise perfis, uso recente e permissões administrativas."
          />

          <div className="grid gap-3 p-4 md:hidden">
            {visibleUsers.length ? (
              visibleUsers.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  saving={savingUserId === user.id}
                  onChangeRole={changeRole}
                />
              ))
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-muted">
                Nenhum usuário encontrado com os filtros atuais.
              </p>
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-[980px] divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.12em] text-muted">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Perfil</th>
                  <th className="px-4 py-3">Uso</th>
                  <th className="px-4 py-3">Último login</th>
                  <th className="px-4 py-3">Criado em</th>
                  <th className="px-4 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleUsers.map((user) => {
                  const status = activityStatus(user);
                  const isAdmin = normalizeRole(user.role) === "admin";
                  return (
                    <tr key={user.id} className="bg-white align-middle">
                      <td className="px-4 py-3">
                        <p className="font-black text-ink">{user.name}</p>
                        <p className="mt-1 text-xs font-semibold text-muted">{user.businessName || "-"}</p>
                      </td>
                      <td className="max-w-[240px] truncate px-4 py-3 font-semibold text-muted">{user.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ring-1 ${roleBadge(user.role)}`}>
                          {roleLabel(user.role)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ring-1 ${status.className}`}>
                            {status.label}
                          </span>
                          <p className="text-xs font-semibold text-muted">
                            {user.counts?.clients || 0} clientes · {user.counts?.appointments || 0} agend.
                          </p>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-muted">{formatDateTime(user.lastLoginAt)}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-muted">{formatDateTime(user.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant={isAdmin ? "secondary" : "primary"}
                          loading={savingUserId === user.id}
                          loadingLabel="Alterando..."
                          onClick={() => changeRole(user, isAdmin ? "user" : "admin")}
                        >
                          {isAdmin ? "Remover admin" : "Conceder admin"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {!visibleUsers.length ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm font-semibold text-muted">
                      Nenhum usuário encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Últimos usuários" description="Cadastros mais recentes da lista filtrada." />
            <div className="space-y-3 p-4">
              {recentUsers.length ? (
                recentUsers.map((user) => (
                  <div key={user.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-ink">{user.name}</p>
                        <p className="truncate text-xs font-semibold text-muted">{user.email}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black ring-1 ${roleBadge(user.role)}`}>
                        {roleLabel(user.role)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-semibold text-muted">Criado em {formatDateTime(user.createdAt)}</p>
                  </div>
                ))
              ) : (
                <p className="p-2 text-sm font-semibold text-muted">Nenhum usuário recente encontrado.</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Eventos dos últimos 7 dias" description="Distribuição dos eventos registrados." />
            <div className="space-y-3 p-4">
              {topEvents.length ? (
                topEvents.map((event) => (
                  <div key={event.eventType} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-ink">{eventLabels[event.eventType] || event.eventType}</p>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-brand ring-1 ring-slate-200">
                        {event.count}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="p-2 text-sm font-semibold text-muted">Ainda não há eventos suficientes.</p>
              )}
            </div>
          </Card>
        </div>
      </section>

      <Card className="overflow-hidden">
        <CardHeader title="Auditoria de acesso e uso" description="Eventos relevantes registrados pelo backend." />

        <div className="grid gap-3 p-4 md:hidden">
          {logs.length ? (
            logs.map((log) => <AuditCard key={log.id} log={log} />)
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-muted">
              Nenhum evento encontrado.
            </p>
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-[820px] divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.12em] text-muted">
              <tr>
                <th className="px-4 py-3">Quando</th>
                <th className="px-4 py-3">Evento</th>
                <th className="px-4 py-3">Usuário</th>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3">Rota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id} className="bg-white align-top">
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-muted">{formatDateTime(log.createdAt)}</td>
                  <td className="px-4 py-3">
                    <p className="font-black text-ink">{eventLabels[log.eventType] || log.eventType}</p>
                    {log.message ? <p className="mt-1 text-xs font-semibold text-muted">{log.message}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-ink">{log.userName || "Sem usuário"}</p>
                    <p className="text-xs font-semibold text-muted">{log.email || "-"}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-muted">{log.ipAddress || "-"}</td>
                  <td className="max-w-[260px] truncate px-4 py-3 font-semibold text-muted">{log.route || "-"}</td>
                </tr>
              ))}
              {!logs.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm font-semibold text-muted">
                    Nenhum evento encontrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <ConfirmDialog
        open={Boolean(pendingRoleChange)}
        title="Confirmar alteração de perfil?"
        description={
          pendingRoleChange
            ? `${pendingRoleChange.nextRole === "admin" ? "Conceder acesso admin para" : "Remover acesso admin de"} ${pendingRoleChange.user.email}.`
            : ""
        }
        confirmLabel="Confirmar"
        danger={pendingRoleChange?.nextRole !== "admin"}
        onConfirm={confirmRoleChange}
        onCancel={() => setPendingRoleChange(null)}
      />
    </div>
  );
}
