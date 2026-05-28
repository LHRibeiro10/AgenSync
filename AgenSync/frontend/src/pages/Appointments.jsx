import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import Button from "../components/Button.jsx";
import Card, { CardHeader } from "../components/Card.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Field, { inputClass, readOnlyInputClass } from "../components/Field.jsx";
import Icon from "../components/Icon.jsx";
import Loading from "../components/Loading.jsx";
import Message from "../components/Message.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useOnboarding } from "../contexts/OnboardingContext.jsx";
import { useWorkspaceView } from "../contexts/WorkspaceViewContext.jsx";
import { useToast } from "../components/Toast.jsx";
import {
  durationLabel,
  durationToMinutes,
  durationUnits
} from "../services/durationService.js";
import { addMinutesToTime, money, statusOptions, todayInputValue } from "../utils.js";

const emptyForm = {
  clientId: "",
  professionalId: "",
  serviceId: "",
  date: todayInputValue(),
  startTime: "09:00",
  durationMinutes: "",
  price: "",
  notes: "",
  status: "agendado"
};
const QUICK_NEW_CLIENT_OPTION = "__new-client__";

function AppointmentPreview({ client, professional, service, form, endTime, editing, onGoAgenda, onToggleManager, managerOpen }) {
  const clientName = client?.name || "Cliente ainda não escolhido";
  const professionalName = professional?.name || "Profissional ainda não escolhido";
  const serviceName = service?.name || "Serviço ainda não escolhido";
  const duration = form.durationMinutes
    ? durationLabel(form.durationMinutes)
    : service
      ? durationLabel(service.durationMinutes)
      : "Escolha um serviço";
  const price = form.price !== "" ? money(form.price) : service ? money(service.priceDefault) : "R$ 0,00";

  return (
    <aside className="space-y-4">
      <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
        <p className="text-xs font-black uppercase text-brand">Prévia do agendamento</p>
        <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black text-brand">{form.date || "Data"}</p>
              <p className="mt-1 text-3xl font-black text-brand">{form.startTime || "00:00"}</p>
              <p className="mt-1 text-xs font-black text-brand/70">até {endTime || "fim previsto"}</p>
            </div>
            <StatusBadge status={form.status} />
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <div>
            <p className="text-xs font-black uppercase text-slate-500">Cliente</p>
            <p className="mt-1 text-base font-black text-ink">{clientName}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase text-slate-500">Profissional</p>
            <p className="mt-1 text-base font-black text-ink">{professionalName}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase text-slate-500">Serviço</p>
            <p className="mt-1 text-base font-black text-ink">{serviceName}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase text-slate-500">Duração</p>
            <p className="mt-1 text-base font-black text-ink">{duration}</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase text-slate-500">Valor</p>
            <p className="mt-1 text-base font-black text-success">{price}</p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-line bg-slate-50 p-4">
          <p className="text-sm font-bold leading-6 text-muted">
            {editing
              ? "Você está editando um agendamento existente. Salve para aplicar as alterações."
              : "Complete cliente, profissional, serviço e horário. A prévia acompanha os dados antes de salvar."}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
        <p className="text-xs font-black uppercase text-slate-500">Atalhos</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <Button variant="secondary" onClick={onGoAgenda}>
            <Icon name="agenda" className="h-4 w-4" />
            Ir à agenda
          </Button>
          <Button variant={managerOpen ? "primary" : "secondary"} onClick={onToggleManager}>
            <Icon name="appointments" className="h-4 w-4" />
            {managerOpen ? "Ocultar agendamentos" : "Editar agendamentos"}
          </Button>
        </div>
      </section>
    </aside>
  );
}

function AppointmentManager({
  appointments,
  loading,
  onClose,
  onEdit,
  onDelete,
  onComplete
}) {
  return (
    <Card className="overflow-hidden shadow-panel">
      <CardHeader
        title="Editar agendamentos"
        description={`${appointments.length} horário(s) na agenda`}
        action={
          <Button variant="secondary" size="sm" onClick={onClose}>
            Fechar lista
          </Button>
        }
      />

      {loading ? (
        <Loading label="Carregando agendamentos..." />
      ) : (
        <div className="compact-scroll-list divide-y divide-line">
          {appointments.length ? (
            appointments.map((appointment) => (
              <article key={appointment.id} className="bg-white p-4 transition duration-200 hover:bg-slate-50">
                <div className="grid gap-3 lg:grid-cols-[116px_1fr_auto] lg:items-center">
                  <div className="rounded-2xl border border-brand/10 bg-blue-50 px-3 py-3 text-brand shadow-sm">
                    <p className="text-xs font-black text-brand/70">{appointment.date}</p>
                    <p className="text-2xl font-black">{appointment.startTime}</p>
                    <p className="text-xs font-black text-brand/70">até {appointment.endTime}</p>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-black text-ink">{appointment.client.name}</p>
                      <StatusBadge status={appointment.status} />
                    </div>
                    <p className="mt-1 text-sm font-bold text-muted">
                      {appointment.service.name} · <span className="font-black text-success">{money(appointment.price)}</span>
                    </p>
                    <p className="mt-1 text-sm font-bold text-muted">
                      Profissional: {appointment.professional?.name || "Não informado"}
                    </p>
                    {appointment.notes ? <p className="mt-2 text-sm text-muted">{appointment.notes}</p> : null}
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Button variant="success" onClick={() => onComplete(appointment)}>
                      Concluir
                    </Button>
                    <Button variant="secondary" onClick={() => onEdit(appointment)}>
                      Editar
                    </Button>
                    <Button variant="danger" onClick={() => onDelete(appointment)}>
                      Excluir
                    </Button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <EmptyState title="Nenhum agendamento cadastrado" description="Crie seu primeiro horário no formulário acima." />
          )}
        </div>
      )}
    </Card>
  );
}

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

export default function Appointments() {
  const location = useLocation();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [clients, setClients] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [services, setServices] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [editIntent, setEditIntent] = useState("");
  const [managerOpen, setManagerOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingConflict, setPendingConflict] = useState(null);
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [quickServiceOpen, setQuickServiceOpen] = useState(false);
  const [quickClientForm, setQuickClientForm] = useState({ name: "", phone: "", notes: "" });
  const [quickServiceForm, setQuickServiceForm] = useState({
    name: "",
    priceDefault: "",
    durationValue: 60,
    durationUnit: "minutes",
    isActive: true
  });
  const [quickSaving, setQuickSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { showToast } = useToast();
  const { markStepComplete } = useOnboarding();
  const { selectedProfessionalId } = useWorkspaceView();

  const selectedService = useMemo(
    () => services.find((service) => service.id === form.serviceId),
    [services, form.serviceId]
  );
  const selectedClient = useMemo(
    () => clients.find((client) => client.id === form.clientId),
    [clients, form.clientId]
  );
  const selectedProfessional = useMemo(
    () => professionals.find((professional) => professional.id === form.professionalId),
    [professionals, form.professionalId]
  );
  const endTime = addMinutesToTime(form.startTime, form.durationMinutes || selectedService?.durationMinutes);

  function sortAppointmentsByStartTime(items) {
    return [...items].sort((first, second) => new Date(first.startsAt) - new Date(second.startsAt));
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const appointmentsData = await api.appointmentsOverview(
        selectedProfessionalId ? { professionalId: selectedProfessionalId } : undefined
      );
      setAppointments(appointmentsData.appointments);
      if (appointmentsData.appointments.length) {
        markStepComplete("appointment", { toast: false });
      }
      setClients(appointmentsData.bootstrap?.clients || []);
      setProfessionals(appointmentsData.bootstrap?.professionals || []);
      setServices(appointmentsData.bootstrap?.services || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [markStepComplete, selectedProfessionalId]);

  useEffect(() => {
    if (loading || editing || form.professionalId) return;

    if (selectedProfessionalId) {
      setForm((current) => ({ ...current, professionalId: selectedProfessionalId }));
      return;
    }

    const activeProfessionals = professionals.filter((professional) => professional.isActive);
    if (activeProfessionals.length === 1) {
      setForm((current) => ({ ...current, professionalId: activeProfessionals[0].id }));
    }
  }, [professionals, loading, editing, form.professionalId, selectedProfessionalId]);

  useEffect(() => {
    if (loading) return;

    const searchParams = new URLSearchParams(location.search);
    const routeEditId = searchParams.get("editar") || location.state?.appointmentId;
    const routeIntent = searchParams.get("acao") || location.state?.intent || "edit";
    const prefillDate = searchParams.get("data") || location.state?.prefill?.date;
    const prefillStartTime = searchParams.get("hora") || location.state?.prefill?.startTime;

    if (!routeEditId) {
      if (prefillDate || prefillStartTime) {
        setEditing(null);
        setEditIntent("");
        setForm((current) => ({
          ...current,
          date: prefillDate || current.date,
          startTime: prefillStartTime || current.startTime
        }));
        setError("");
        window.scrollTo({ top: 0, behavior: "smooth" });
        navigate("/agendamentos", { replace: true, state: null });
      }
      return;
    }

    const appointment = appointments.find((item) => item.id === routeEditId);
    if (!appointment) {
      const message = "Agendamento não encontrado para edição.";
      setError(message);
      showToast(message, "error");
      navigate("/agendamentos", { replace: true, state: null });
      return;
    }

    startEdit(appointment, routeIntent);
    navigate("/agendamentos", { replace: true, state: null });
  }, [appointments, loading, location.search, location.state, navigate]);

  function activeServicesForForm() {
    if (!editing) return services.filter((service) => service.isActive);
    const current = appointments.find((appointment) => appointment.id === editing);
    return services.filter((service) => service.isActive || service.id === current?.serviceId);
  }

  function activeProfessionalsForForm() {
    if (!editing) return professionals.filter((professional) => professional.isActive);
    const current = appointments.find((appointment) => appointment.id === editing);
    return professionals.filter((professional) => professional.isActive || professional.id === current?.professionalId);
  }

  function update(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "serviceId") {
        const service = services.find((item) => item.id === value);
        if (service) {
          next.price = service.priceDefault;
          next.durationMinutes = service.durationMinutes;
        } else {
          next.price = "";
          next.durationMinutes = "";
        }
      }
      return next;
    });
  }

  function startEdit(appointment, intent = "edit") {
    setEditing(appointment.id);
    setEditIntent(intent);
    setForm({
      clientId: appointment.clientId,
      professionalId: appointment.professionalId || "",
      serviceId: appointment.serviceId,
      date: appointment.date,
      startTime: appointment.startTime,
      durationMinutes: appointment.durationMinutes || appointment.service?.durationMinutes || "",
      price: appointment.price,
      notes: appointment.notes || "",
      status: appointment.status
    });
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditing(null);
    setEditIntent("");
    setForm(emptyForm);
  }

  function conflictDetailsFromError(error) {
    if (!error?.details) return null;
    if (error.details?.details && typeof error.details.details === "object") return error.details.details;
    if (typeof error.details === "object") return error.details;
    return null;
  }

  function isConflictError(error) {
    const details = conflictDetailsFromError(error);
    return error?.status === 409 && details?.code === "APPOINTMENT_CONFLICT";
  }

  function conflictDescription(conflict) {
    if (!conflict) return "Existe um agendamento em andamento nesse horário. Deseja continuar mesmo assim?";

    const clientText = conflict.clientName ? ` para ${conflict.clientName}` : "";
    const serviceText = conflict.serviceName ? ` (${conflict.serviceName})` : "";
    return `Existe outro atendimento${clientText}${serviceText} das ${conflict.startTime} às ${conflict.endTime}. Deseja continuar mesmo assim?`;
  }

  async function persistAppointment(payload) {
    if (editing) {
      const result = await api.updateAppointment(editing, payload);
      setAppointments((current) =>
        sortAppointmentsByStartTime(
          current.map((appointment) => (appointment.id === result.appointment.id ? result.appointment : appointment))
        )
      );
      showToast(editIntent === "reschedule" ? "Agendamento reagendado." : "Agendamento atualizado.");
      return;
    }

    const result = await api.createAppointment(payload);
    setAppointments((current) => sortAppointmentsByStartTime([...current, result.appointment]));
    markStepComplete("appointment", { toast: false });
    showToast("Agendamento criado.");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      ...form,
      price: Number(form.price),
      durationMinutes: Number(form.durationMinutes || selectedService?.durationMinutes || 0)
    };

    try {
      await persistAppointment(payload);
      resetForm();
    } catch (err) {
      if (isConflictError(err)) {
        const details = conflictDetailsFromError(err);
        setPendingConflict({ payload, conflict: details?.conflict || null });
        setError("");
        return;
      }
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmConflictSave() {
    if (!pendingConflict) return;
    setSaving(true);
    setError("");

    try {
      await persistAppointment({ ...pendingConflict.payload, confirmConflict: true });
      setPendingConflict(null);
      resetForm();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setError("");

    try {
      await api.deleteAppointment(pendingDelete.id);
      showToast("Agendamento excluido.");
      setAppointments((current) => current.filter((item) => item.id !== pendingDelete.id));
      if (editing === pendingDelete.id) {
        resetForm();
      }
      setPendingDelete(null);
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
      setPendingDelete(null);
    }
  }

  async function updateStatus(appointment, status) {
    setError("");
    try {
      const result = await api.updateAppointment(appointment.id, { status });
      setAppointments((current) =>
        sortAppointmentsByStartTime(
          current.map((item) => (item.id === result.appointment.id ? result.appointment : item))
        )
      );
      showToast("Status atualizado.");
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
      update("clientId", result.client.id);
      setQuickClientForm({ name: "", phone: "", notes: "" });
      setQuickClientOpen(false);
      markStepComplete("client", { toast: false });
      showToast("Cliente cadastrado e selecionado.");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setQuickSaving(false);
    }
  }

  async function createQuickService(event) {
    event.preventDefault();
    setQuickSaving(true);
    setError("");

    const payload = {
      ...quickServiceForm,
      priceDefault: Number(quickServiceForm.priceDefault),
      durationMinutes: durationToMinutes(quickServiceForm.durationValue, quickServiceForm.durationUnit),
      isActive: true
    };
    delete payload.durationValue;
    delete payload.durationUnit;

    if (!payload.durationMinutes) {
      showToast("Informe uma duracao valida.", "error");
      setQuickSaving(false);
      return;
    }

    try {
      const result = await api.createService(payload);
      setServices((current) => [...current, result.service].sort((first, second) => first.name.localeCompare(second.name)));
      setForm((current) => ({
        ...current,
        serviceId: result.service.id,
        price: result.service.priceDefault,
        durationMinutes: result.service.durationMinutes
      }));
      setQuickServiceForm({ name: "", priceDefault: "", durationValue: 60, durationUnit: "minutes", isActive: true });
      setQuickServiceOpen(false);
      markStepComplete("service", { toast: false });
      showToast("Serviço cadastrado e selecionado.");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setQuickSaving(false);
    }
  }

  const formProfessionals = activeProfessionalsForForm();
  const formServices = activeServicesForForm();
  const isRescheduling = editing && editIntent === "reschedule";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agendamentos"
        description="Crie ou edite atendimentos com uma prévia clara antes de salvar."
        action={
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => navigate("/agenda")}>
              <Icon name="agenda" className="h-4 w-4" />
              Ir à agenda
            </Button>
            <Button variant="secondary" onClick={() => setManagerOpen((current) => !current)}>
              <Icon name="appointments" className="h-4 w-4" />
              {managerOpen ? "Ocultar agendamentos" : "Editar agendamentos"}
            </Button>
          </div>
        }
      />
      <Message type="error">{error}</Message>

      <section className="grid gap-5 xl:grid-cols-[minmax(420px,560px)_minmax(300px,420px)] xl:items-start">
        <Card as="form" onSubmit={handleSubmit} className="overflow-hidden shadow-panel">
          <div className="border-b border-line bg-slate-50 p-5">
            <span className="inline-flex rounded-xl bg-blue-100 px-3 py-1 text-xs font-black uppercase text-brand">
              {isRescheduling ? "Reagendamento" : editing ? "Edição" : "Agendamento"}
            </span>
            <h2 className="mt-3 text-2xl font-black text-ink">
              {isRescheduling ? "Reagendar atendimento" : editing ? "Editar atendimento" : "Novo agendamento"}
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">
              Escolha cliente, profissional, serviço e horário. O sistema mantém a validação de conflitos por agenda.
            </p>
          </div>

          <div className="space-y-4 p-5">
            <div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-black text-ink sm:text-sm">Cliente</span>
                <Button variant="ghost" size="sm" onClick={() => setQuickClientOpen(true)}>
                  + Novo cliente
                </Button>
              </div>
              <select
                required
                value={form.clientId}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  if (nextValue === QUICK_NEW_CLIENT_OPTION) {
                    setQuickClientOpen(true);
                    return;
                  }
                  update("clientId", nextValue);
                }}
                className={`${inputClass} mt-1`}
              >
                <option value="">Selecione</option>
                <option value={QUICK_NEW_CLIENT_OPTION}>+ Cadastrar cliente rapido</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>

            <Field label="Profissional">
              <select
                required
                value={form.professionalId}
                onChange={(event) => update("professionalId", event.target.value)}
                className={inputClass}
              >
                <option value="">Selecione</option>
                {formProfessionals.map((professional) => (
                  <option key={professional.id} value={professional.id}>
                    {professional.name}
                    {professional.role ? ` · ${professional.role}` : ""}
                    {professional.isActive ? "" : " · inativo"}
                  </option>
                ))}
              </select>
            </Field>

            <div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-black text-ink sm:text-sm">Serviço</span>
                <Button variant="ghost" size="sm" onClick={() => setQuickServiceOpen(true)}>
                  + Novo serviço
                </Button>
              </div>
              <select
                required
                value={form.serviceId}
                onChange={(event) => update("serviceId", event.target.value)}
                className={`${inputClass} mt-1`}
              >
                <option value="">Selecione</option>
                {formServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} - {durationLabel(service.durationMinutes)} {service.isActive ? "" : "- inativo"}
                  </option>
                ))}
              </select>
            </div>

            {selectedService ? (
              <div className="grid grid-cols-2 gap-3 rounded-2xl border border-brand/20 bg-blue-50 p-4 shadow-sm">
                <div>
                  <p className="text-xs font-black uppercase text-brand/70">Duração</p>
                  <p className="text-sm font-black text-brand">{durationLabel(selectedService.durationMinutes)}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-brand/70">Valor padrão</p>
                  <p className="text-sm font-black text-brand">{money(selectedService.priceDefault)}</p>
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Data">
                <input
                  required
                  type="date"
                  value={form.date}
                  onChange={(event) => update("date", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Hora inicial">
                <input
                  required
                  type="time"
                  value={form.startTime}
                  onChange={(event) => update("startTime", event.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Duracao deste atendimento">
                <input
                  required
                  min="1"
                  type="number"
                  value={form.durationMinutes}
                  onChange={(event) => update("durationMinutes", event.target.value)}
                  className={inputClass}
                />
                <p className="mt-1 text-xs font-semibold text-muted">
                  Esse valor sobrescreve a duracao padrao do servico somente neste horario.
                </p>
              </Field>
              <Field label="Valor">
                <input
                  required
                  min="0"
                  step="0.01"
                  type="number"
                  value={form.price}
                  onChange={(event) => update("price", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Fim previsto">
                <input readOnly value={endTime || "Escolha um serviço"} className={readOnlyInputClass} />
              </Field>
            </div>

            <Field label="Status">
              <select value={form.status} onChange={(event) => update("status", event.target.value)} className={inputClass}>
                {statusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Observações">
              <textarea
                value={form.notes}
                onChange={(event) => update("notes", event.target.value)}
                className={`${inputClass} min-h-24 resize-none`}
                placeholder="Detalhes do atendimento"
              />
            </Field>

            <div className="grid grid-cols-2 gap-2">
              {editing ? (
                <Button variant="secondary" onClick={resetForm}>
                  Cancelar edição
                </Button>
              ) : null}
              <Button type="submit" size="lg" loading={saving} className={editing ? "" : "col-span-2"}>
                {isRescheduling ? "Salvar reagendamento" : editing ? "Atualizar agendamento" : "Salvar agendamento"}
              </Button>
            </div>
          </div>
        </Card>

        <AppointmentPreview
          client={selectedClient}
          professional={selectedProfessional}
          service={selectedService}
          form={form}
          endTime={endTime}
          editing={Boolean(editing)}
          managerOpen={managerOpen}
          onGoAgenda={() => navigate("/agenda")}
          onToggleManager={() => setManagerOpen((current) => !current)}
        />
      </section>

      {managerOpen ? (
        <AppointmentManager
          appointments={appointments}
          loading={loading}
          onClose={() => setManagerOpen(false)}
          onEdit={startEdit}
          onDelete={setPendingDelete}
          onComplete={(appointment) => updateStatus(appointment, "concluido")}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingConflict)}
        title="Horario em conflito"
        description={conflictDescription(pendingConflict?.conflict)}
        confirmLabel="Continuar mesmo assim"
        cancelLabel="Voltar"
        onConfirm={confirmConflictSave}
        onCancel={() => setPendingConflict(null)}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Excluir agendamento?"
        description={
          pendingDelete
            ? `O horário de ${pendingDelete.client.name} às ${pendingDelete.startTime} será removido.`
            : ""
        }
        confirmLabel="Excluir"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <QuickCreateModal
        open={quickClientOpen}
        title="Novo cliente"
        description="Cadastre sem sair do agendamento."
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
            required
            minLength={8}
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
            placeholder="Preferências ou detalhes importantes"
          />
        </Field>
      </QuickCreateModal>

      <QuickCreateModal
        open={quickServiceOpen}
        title="Novo serviço"
        description="O novo serviço já fica selecionado neste agendamento."
        saving={quickSaving}
        onSubmit={createQuickService}
        onClose={() => setQuickServiceOpen(false)}
      >
        <Field label="Nome">
          <input
            required
            minLength={2}
            value={quickServiceForm.name}
            onChange={(event) => setQuickServiceForm((current) => ({ ...current, name: event.target.value }))}
            className={inputClass}
            placeholder="Drenagem, corte, limpeza"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Preço padrão">
            <input
              required
              min="0"
              step="0.01"
              type="number"
              value={quickServiceForm.priceDefault}
              onChange={(event) => setQuickServiceForm((current) => ({ ...current, priceDefault: event.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field label="Tempo estimado">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_132px]">
              {quickServiceForm.durationUnit === "day" ? (
                <select
                  value={quickServiceForm.durationValue}
                  onChange={(event) => setQuickServiceForm((current) => ({ ...current, durationValue: event.target.value }))}
                  className={inputClass}
                >
                  <option value={1}>Dia todo</option>
                </select>
              ) : (
                <input
                  required
                  min="1"
                  step={quickServiceForm.durationUnit === "hours" ? "0.25" : "1"}
                  type="number"
                  value={quickServiceForm.durationValue}
                  onChange={(event) => setQuickServiceForm((current) => ({ ...current, durationValue: event.target.value }))}
                  className={inputClass}
                />
              )}
              <select
                value={quickServiceForm.durationUnit}
                onChange={(event) => {
                  const nextUnit = event.target.value;
                  setQuickServiceForm((current) => ({
                    ...current,
                    durationUnit: nextUnit,
                    durationValue: nextUnit === "day" ? 1 : current.durationValue
                  }));
                }}
                className={inputClass}
              >
                {durationUnits.map((unit) => (
                  <option key={unit.value} value={unit.value}>
                    {unit.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1 text-xs font-semibold text-muted">
              Salvo como {durationLabel(durationToMinutes(quickServiceForm.durationValue, quickServiceForm.durationUnit))}.
            </p>
          </Field>
        </div>
      </QuickCreateModal>
    </div>
  );
}

