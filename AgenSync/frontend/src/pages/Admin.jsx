import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import Button from "../components/Button.jsx";
import Card, { CardHeader } from "../components/Card.jsx";
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
  "admin.role_changed": "Role alterada"
};

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function roleBadge(role) {
  const isAdmin = role === "admin";
  return isAdmin
    ? "bg-blue-50 text-blue-700 ring-blue-200"
    : "bg-slate-100 text-slate-700 ring-slate-200";
}

function activityStatus(user) {
  if (!user.lastActivityAt) return { label: "Sem atividade", className: "bg-slate-100 text-slate-600 ring-slate-200" };
  const days = Math.floor((Date.now() - new Date(user.lastActivityAt).getTime()) / 86400000);
  if (days <= 7) return { label: "Ativo", className: "bg-green-50 text-success ring-green-200" };
  if (days <= 30) return { label: "Recente", className: "bg-blue-50 text-blue-700 ring-blue-200" };
  return { label: "Inativo", className: "bg-amber-50 text-amber-700 ring-amber-200" };
}

function StatTile({ label, value, detail }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 text-3xl font-black text-ink">{value}</p>
      {detail ? <p className="mt-1 text-sm font-semibold text-muted">{detail}</p> : null}
    </article>
  );
}

export default function Admin() {
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [eventType, setEventType] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState("");
  const [error, setError] = useState("");

  async function load(filters = { search: appliedSearch, eventType }) {
    setLoading(true);
    setError("");
    try {
      const [summaryData, usersData, logsData] = await Promise.all([
        api.adminSummary(),
        api.listAdminUsers({ take: 100, search: filters.search }),
        api.listAdminAuditLogs({ take: 100, eventType: filters.eventType })
      ]);

      setSummary(summaryData);
      setUsers(usersData);
      setLogs(logsData);
    } catch (err) {
      setError(err.message || "Nao foi possivel carregar o painel admin.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load({ search: "", eventType: "" });
  }, []);

  function applyFilters(event) {
    event.preventDefault();
    const nextSearch = search.trim();
    setAppliedSearch(nextSearch);
    load({ search: nextSearch, eventType });
  }

  function clearFilters() {
    setSearch("");
    setAppliedSearch("");
    setEventType("");
    load({ search: "", eventType: "" });
  }

  async function changeRole(user, nextRole) {
    if (user.role === nextRole) return;
    const confirmed = window.confirm(`Alterar ${user.email} para ${nextRole}?`);
    if (!confirmed) return;

    setSavingUserId(user.id);
    setError("");
    try {
      const updated = await api.updateAdminUserRole(user.id, nextRole);
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      const [summaryData, logsData] = await Promise.all([
        api.adminSummary(),
        api.listAdminAuditLogs({ take: 100 })
      ]);
      setSummary(summaryData);
      setLogs(logsData);
    } catch (err) {
      setError(err.message || "Nao foi possivel alterar o role.");
    } finally {
      setSavingUserId("");
    }
  }

  const recordSummary = summary?.records || {};
  const topEvents = useMemo(() => summary?.events7Days || [], [summary]);

  if (loading && !summary) return <Loading label="Carregando painel admin..." />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Painel Admin"
        description="Controle de acesso, auditoria e indicadores administrativos do AgenSync."
      />

      <Message type="error" actionLabel="Tentar novamente" onAction={load}>
        {error}
      </Message>

      {summary ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Usuarios comuns" value={summary.commonUsers || 0} detail={`${summary.newUsers7Days || 0} novos em 7 dias`} />
            <StatTile label="Admins" value={summary.admins || 0} detail="Usuarios com acesso administrativo" />
            <StatTile label="Logins usuarios" value={summary.logins7Days || 0} detail={`${summary.loginFailures7Days || 0} falhas recentes`} />
            <StatTile label="Usuarios totais" value={summary.totalUsers || 0} detail="Inclui admins ocultos na lista" />
          </section>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <StatTile label="Clientes" value={recordSummary.clients || 0} />
            <StatTile label="Agendamentos" value={recordSummary.appointments || 0} />
            <StatTile label="Vendas" value={recordSummary.productSales || 0} />
            <StatTile label="Mensalidades" value={recordSummary.monthlyPlans || 0} />
            <StatTile label="Despesas" value={recordSummary.expenses || 0} />
            <StatTile label="Produtos" value={recordSummary.products || 0} />
          </section>
        </>
      ) : null}

      <Card as="form" onSubmit={applyFilters} className="p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px_auto_auto] lg:items-end">
          <Field label="Buscar usuario comum">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={inputClass}
              placeholder="Nome, email ou negocio"
            />
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
          <Button type="submit">Filtrar</Button>
          <Button variant="secondary" onClick={clearFilters}>
            Limpar
          </Button>
        </div>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <Card className="overflow-hidden">
          <CardHeader title="Usuarios comuns" description="Admins e seus proprios acessos ficam ocultos nesta lista." />
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.14em] text-muted">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Uso</th>
                  <th className="px-4 py-3">Ultimo login</th>
                  <th className="px-4 py-3">Criado em</th>
                  <th className="px-4 py-3 text-right">Acao</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.id} className="bg-white align-middle">
                    <td className="px-4 py-3">
                      <p className="font-black text-ink">{user.name}</p>
                      <p className="mt-1 text-xs font-semibold text-muted">{user.businessName || "-"}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-muted">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ring-1 ${roleBadge(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ring-1 ${activityStatus(user).className}`}>
                          {activityStatus(user).label}
                        </span>
                        <p className="text-xs font-semibold text-muted">
                          {user.counts?.clients || 0} clientes · {user.counts?.appointments || 0} agend.
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-muted">{formatDateTime(user.lastLoginAt)}</td>
                    <td className="px-4 py-3 font-semibold text-muted">{formatDateTime(user.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="primary"
                        loading={savingUserId === user.id}
                        loadingLabel="Alterando..."
                        onClick={() => changeRole(user, "admin")}
                      >
                        Conceder admin
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="Eventos dos ultimos 7 dias" description="Distribuicao dos eventos registrados." />
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
              <p className="p-2 text-sm font-semibold text-muted">Ainda nao ha eventos suficientes.</p>
            )}
          </div>
        </Card>
      </section>

      <Card className="overflow-hidden">
        <CardHeader title="Auditoria de acesso e uso" description="Somente eventos de usuarios comuns. Seus acessos admin nao aparecem aqui." />
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.14em] text-muted">
              <tr>
                <th className="px-4 py-3">Quando</th>
                <th className="px-4 py-3">Evento</th>
                <th className="px-4 py-3">Usuario</th>
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
                    <p className="font-bold text-ink">{log.userName || "Sem usuario"}</p>
                    <p className="text-xs font-semibold text-muted">{log.email || "-"}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-muted">{log.ipAddress || "-"}</td>
                  <td className="max-w-[260px] truncate px-4 py-3 font-semibold text-muted">{log.route || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
