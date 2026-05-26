import { useEffect, useMemo, useState } from "react";
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
import { getCurrentPlan } from "../config/plans.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { money } from "../utils.js";

const emptyForm = { name: "", role: "", email: "", phone: "", isActive: true };
const emptyAccessForm = { name: "", email: "", password: "", role: "professional" };

function initials(name) {
  return String(name || "P")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function buildStats(professionals, appointments) {
  return professionals.map((professional) => {
    const items = appointments.filter((appointment) => appointment.professionalId === professional.id);
    const completed = items.filter((appointment) => appointment.status === "concluido");

    return {
      id: professional.id,
      total: items.length,
      completed: completed.length,
      revenue: completed.reduce((sum, appointment) => sum + Number(appointment.price || 0), 0)
    };
  });
}

export default function Professionals() {
  const [professionals, setProfessionals] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [accessProfessionalId, setAccessProfessionalId] = useState("");
  const [accessForm, setAccessForm] = useState(emptyAccessForm);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingAccess, setCreatingAccess] = useState(false);
  const [error, setError] = useState("");
  const { showToast } = useToast();
  const { user, workspaceRole } = useAuth();

  const stats = useMemo(() => buildStats(professionals, appointments), [professionals, appointments]);
  const statsByProfessional = useMemo(
    () => Object.fromEntries(stats.map((item) => [item.id, item])),
    [stats]
  );
  const topProfessional = useMemo(() => {
    return stats
      .map((item) => ({
        ...item,
        professional: professionals.find((professional) => professional.id === item.id)
      }))
      .sort((first, second) => second.total - first.total || second.completed - first.completed)[0];
  }, [professionals, stats]);

  async function loadAll() {
    setLoading(true);
    setError("");

    try {
      const [professionalsData, appointmentsData] = await Promise.all([
        api.listProfessionals(),
        api.listAppointments()
      ]);
      setProfessionals(professionalsData.professionals);
      setAppointments(appointmentsData.appointments);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function loadProfessionalsOnly() {
    const professionalsData = await api.listProfessionals();
    setProfessionals(professionalsData.professionals);
  }

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateAccess(field, value) {
    setAccessForm((current) => ({ ...current, [field]: value }));
  }

  function startAccess(professional) {
    setAccessProfessionalId(professional.id);
    setAccessForm({
      name: professional.name || "",
      email: professional.email || "",
      password: "",
      role: "professional"
    });
    setError("");
  }

  function startEditAccess(professional) {
    setAccessProfessionalId(professional.id);
    setAccessForm({
      name: professional.access?.name || professional.name || "",
      email: professional.access?.email || professional.email || "",
      password: "",
      role: professional.access?.role || "professional"
    });
    setError("");
  }

  function startEdit(professional) {
    setEditing(professional.id);
    setForm({
      name: professional.name,
      role: professional.role || "",
      email: professional.email || "",
      phone: professional.phone || "",
      isActive: professional.isActive
    });
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditing(null);
    setForm(emptyForm);
  }

  function resetAccessForm() {
    setAccessProfessionalId("");
    setAccessForm(emptyAccessForm);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (editing) {
        await api.updateProfessional(editing, form);
        showToast("Profissional atualizado.");
      } else {
        await api.createProfessional(form);
        showToast("Profissional cadastrado.");
      }

      resetForm();
      await loadProfessionalsOnly();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateAccess(event, professional) {
    event.preventDefault();
    setCreatingAccess(true);
    setError("");

    try {
      if (professional.access) {
        await api.updateProfessionalAccess(professional.id, accessForm);
        showToast("Usuario afiliado atualizado.");
      } else {
        await api.createProfessionalAccess(professional.id, accessForm);
        showToast("Usuario afiliado criado.");
      }
      resetAccessForm();
      await loadProfessionalsOnly();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setCreatingAccess(false);
    }
  }

  async function toggleActive(professional) {
    setError("");

    if (!professional.isActive && activeCount >= currentPlan.maxProfessionals) {
      const message = `Seu plano atual permite ate ${currentPlan.maxProfessionals} profissional(is).`;
      setError(message);
      showToast(message, "error");
      return;
    }

    try {
      await api.updateProfessional(professional.id, {
        name: professional.name,
        role: professional.role,
        email: professional.email || "",
        phone: professional.phone,
        isActive: !professional.isActive
      });
      showToast(professional.isActive ? "Profissional inativado." : "Profissional ativado.");
      await loadProfessionalsOnly();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setError("");

    try {
      await api.deleteProfessional(pendingDelete.id);
      showToast("Profissional excluído.");
      setPendingDelete(null);
      if (editing === pendingDelete.id) resetForm();
      await loadProfessionalsOnly();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
      setPendingDelete(null);
    }
  }

  const currentPlan = getCurrentPlan(user);
  const canManageAccess = workspaceRole === "owner" || workspaceRole === "admin";
  const activeCount = professionals.filter((professional) => professional.isActive).length;
  const professionalLimitReached = !editing && form.isActive && activeCount >= currentPlan.maxProfessionals;
  const totalRevenue = stats.reduce((sum, item) => sum + item.revenue, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Profissionais"
        description="Registre a equipe e acompanhe quem atende cada cliente em cada horário."
      />
      <Message type="error">{error}</Message>

      <section className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <Card as="form" onSubmit={handleSubmit} className="space-y-4 p-4 lg:sticky lg:top-24 lg:self-start">
          <div>
            <h2 className="text-lg font-black text-ink">{editing ? "Editar profissional" : "Novo profissional"}</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Profissionais ativos aparecem como opção na criação de agendamentos.
            </p>
            {!editing ? (
              <p className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-black text-brand">
                Plano {currentPlan.displayName}: {activeCount}/{currentPlan.maxProfessionals} profissional(is) ativo(s).
              </p>
            ) : null}
          </div>

          <Field label="Nome">
            <input
              required
              minLength={2}
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              className={inputClass}
              placeholder="Ex: Marina Alves"
            />
          </Field>

          <Field label="Cargo ou especialidade">
            <input
              value={form.role}
              onChange={(event) => update("role", event.target.value)}
              className={inputClass}
              placeholder="Manicure, barbeiro, fisioterapeuta"
            />
          </Field>

          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
              className={inputClass}
              placeholder="profissional@empresa.com"
            />
          </Field>

          <Field label="Telefone">
            <input
              value={form.phone}
              onChange={(event) => update("phone", event.target.value)}
              className={inputClass}
              placeholder="(11) 90000-0000"
            />
          </Field>

          <label className="flex min-h-14 items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-3">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => update("isActive", event.target.checked)}
              className="h-5 w-5 accent-brand"
            />
            <span className="text-sm font-bold text-ink">Ativo para novos agendamentos</span>
          </label>

          <div className="grid grid-cols-2 gap-2">
            {editing ? (
              <Button variant="secondary" onClick={resetForm}>
                Cancelar
              </Button>
            ) : null}
            <Button
              type="submit"
              loading={saving}
              disabled={professionalLimitReached}
              className={editing ? "" : "col-span-2"}
            >
              {editing ? "Atualizar" : "Cadastrar"}
            </Button>
          </div>
          {professionalLimitReached ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700">
              Seu plano atual permite ate {currentPlan.maxProfessionals} profissional(is).
            </p>
          ) : null}
        </Card>

        <div className="space-y-5">
          <section className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-line bg-white p-4 shadow-soft">
              <p className="text-xs font-black uppercase text-slate-500">Profissionais ativos</p>
              <p className="mt-2 text-3xl font-black text-brand">{activeCount}</p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4 shadow-soft">
              <p className="text-xs font-black uppercase text-slate-500">Mais atende</p>
              <p className="mt-2 truncate text-xl font-black text-ink">
                {topProfessional?.total ? topProfessional.professional?.name : "Sem dados"}
              </p>
              <p className="mt-1 text-sm font-bold text-muted">
                {topProfessional?.total ? `${topProfessional.total} atendimento(s)` : "Aguardando agenda"}
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-white p-4 shadow-soft">
              <p className="text-xs font-black uppercase text-slate-500">Receita concluída</p>
              <p className="mt-2 text-2xl font-black text-success">{money(totalRevenue)}</p>
            </div>
          </section>

          <Card>
            <CardHeader
              title="Equipe cadastrada"
              description={`${professionals.length} profissional(is) vinculados aos agendamentos`}
            />
            {loading ? (
              <Loading label="Carregando profissionais..." />
            ) : (
              <div className="compact-scroll-list divide-y divide-[#E2E8F0]">
                {professionals.length ? (
                  professionals.map((professional) => {
                    const itemStats = statsByProfessional[professional.id] || { total: 0, completed: 0, revenue: 0 };

                    return (
                      <article
                        key={professional.id}
                        className="grid gap-4 p-4 transition duration-200 hover:bg-[#F8FAFC] sm:grid-cols-[1fr_auto] sm:items-center"
                      >
                        <div className="flex min-w-0 gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-sm font-black text-brand ring-1 ring-blue-100">
                            {initials(professional.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-black text-ink">{professional.name}</p>
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-black ring-1 ${
                                  professional.isActive
                                    ? "bg-green-50 text-success ring-green-100"
                                    : "bg-zinc-100 text-zinc-600 ring-zinc-200"
                                }`}
                              >
                                {professional.isActive ? "Ativo" : "Inativo"}
                              </span>
                            </div>
                            <p className="mt-1 text-sm font-semibold text-muted">
                              {professional.role || "Sem especialidade informada"}
                              {professional.phone ? ` · ${professional.phone}` : ""}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-slate-600">
                              <span className="rounded-full bg-slate-100 px-3 py-1">{itemStats.total} atendimento(s)</span>
                              <span className="rounded-full bg-emerald-50 px-3 py-1 text-success">
                                {itemStats.completed} concluído(s)
                              </span>
                              <span className="rounded-full bg-blue-50 px-3 py-1 text-brand">
                                {money(itemStats.revenue)}
                              </span>
                              {professional.access ? (
                                <span className="rounded-full bg-violet-50 px-3 py-1 text-violet-700">
                                  Acesso {professional.access.role === "admin" ? "admin" : "profissional"}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                          {canManageAccess && !professional.access ? (
                            <Button variant="secondary" onClick={() => startAccess(professional)}>
                              Criar acesso
                            </Button>
                          ) : null}
                          {canManageAccess && professional.access ? (
                            <Button variant="secondary" onClick={() => startEditAccess(professional)}>
                              Editar acesso
                            </Button>
                          ) : null}
                          <Button variant="secondary" onClick={() => toggleActive(professional)}>
                            {professional.isActive ? "Inativar" : "Ativar"}
                          </Button>
                          <Button variant="secondary" onClick={() => startEdit(professional)}>
                            Editar
                          </Button>
                          <Button variant="danger" className="col-span-2" onClick={() => setPendingDelete(professional)}>
                            Excluir
                          </Button>
                        </div>

                        {accessProfessionalId === professional.id ? (
                          <form
                            onSubmit={(event) => handleCreateAccess(event, professional)}
                            className="grid gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-3 sm:col-span-2 md:grid-cols-[1fr_1fr_1fr_160px_auto]"
                          >
                            <Field label="Nome do acesso">
                              <input
                                required
                                minLength={2}
                                value={accessForm.name}
                                onChange={(event) => updateAccess("name", event.target.value)}
                                className={inputClass}
                                placeholder="Nome do profissional"
                              />
                            </Field>
                            <Field label="Email do acesso">
                              <input
                                required
                                type="email"
                                value={accessForm.email}
                                onChange={(event) => updateAccess("email", event.target.value)}
                                className={inputClass}
                                placeholder="email@empresa.com"
                              />
                            </Field>
                            <Field label="Senha inicial">
                              <input
                                required={!professional.access}
                                minLength={6}
                                type="password"
                                value={accessForm.password}
                                onChange={(event) => updateAccess("password", event.target.value)}
                                className={inputClass}
                                placeholder={professional.access ? "Deixe em branco para manter" : "Minimo 6 caracteres"}
                              />
                            </Field>
                            <Field label="Funcao">
                              <select
                                value={accessForm.role}
                                onChange={(event) => updateAccess("role", event.target.value)}
                                className={inputClass}
                              >
                                <option value="professional">Profissional</option>
                                <option value="admin">Admin</option>
                              </select>
                            </Field>
                            <div className="flex items-end gap-2">
                              <Button type="submit" loading={creatingAccess} loadingLabel="Criando...">
                                {professional.access ? "Salvar" : "Criar"}
                              </Button>
                              <Button type="button" variant="secondary" onClick={resetAccessForm}>
                                Cancelar
                              </Button>
                            </div>
                          </form>
                        ) : null}
                      </article>
                    );
                  })
                ) : (
                  <EmptyState
                    title="Nenhum profissional cadastrado"
                    description="Cadastre quem atende para liberar a escolha no novo agendamento."
                  />
                )}
              </div>
            )}
          </Card>
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Excluir profissional?"
        description={
          pendingDelete
            ? `${pendingDelete.name} será removido se não houver agendamentos vinculados.`
            : ""
        }
        confirmLabel="Excluir"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
