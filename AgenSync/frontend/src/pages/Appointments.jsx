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
import ReminderModal from "../components/ReminderModal.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { useToast } from "../components/Toast.jsx";
import { addMinutesToTime, money, statusOptions, todayInputValue } from "../utils.js";

const emptyForm = {
  clientId: "",
  professionalId: "",
  serviceId: "",
  date: todayInputValue(),
  startTime: "09:00",
  price: "",
  notes: "",
  status: "agendado"
};

function AppointmentPreview({ client, professional, service, form, endTime, editing, onGoAgenda, onToggleManager, managerOpen }) {
  const clientName = client?.name || "Cliente ainda não escolhido";
  const professionalName = professional?.name || "Profissional ainda não escolhido";
  const serviceName = service?.name || "Serviço ainda não escolhido";
  const duration = service ? `${service.durationMinutes} min` : "Escolha um serviço";
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
  onReminder,
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
                    <Button variant="secondary" onClick={() => onReminder(appointment)}>
                      <Icon name="message" className="h-4 w-4" />
                      Lembrete
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
  const [reminderAppointment, setReminderAppointment] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { showToast } = useToast();

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
  const endTime = addMinutesToTime(form.startTime, selectedService?.durationMinutes);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [appointmentsData, clientsData, professionalsData, servicesData] = await Promise.all([
        api.listAppointments(),
        api.listClients(),
        api.listProfessionals(),
        api.listServices()
      ]);
      setAppointments(appointmentsData.appointments);
      setClients(clientsData.clients);
      setProfessionals(professionalsData.professionals);
      setServices(servicesData.services);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (loading || editing || form.professionalId) return;

    const activeProfessionals = professionals.filter((professional) => professional.isActive);
    if (activeProfessionals.length === 1) {
      setForm((current) => ({ ...current, professionalId: activeProfessionals[0].id }));
    }
  }, [professionals, loading, editing, form.professionalId]);

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
        if (service) next.price = service.priceDefault;
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

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      ...form,
      price: Number(form.price)
    };

    try {
      if (editing) {
        await api.updateAppointment(editing, payload);
        showToast(editIntent === "reschedule" ? "Agendamento reagendado." : "Agendamento atualizado.");
      } else {
        await api.createAppointment(payload);
        showToast("Agendamento criado.");
      }
      resetForm();
      await load();
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
      showToast("Agendamento excluído.");
      setPendingDelete(null);
      await load();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
      setPendingDelete(null);
    }
  }

  async function updateStatus(appointment, status) {
    setError("");
    try {
      await api.updateAppointment(appointment.id, { status });
      showToast("Status atualizado.");
      await load();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
  }

  function openReminder(appointment) {
    setReminderAppointment(appointment);
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
            <Field label="Cliente">
              <select
                required
                value={form.clientId}
                onChange={(event) => update("clientId", event.target.value)}
                className={inputClass}
              >
                <option value="">Selecione</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </Field>

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

            <Field label="Serviço">
              <select
                required
                value={form.serviceId}
                onChange={(event) => update("serviceId", event.target.value)}
                className={inputClass}
              >
                <option value="">Selecione</option>
                {formServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} · {service.durationMinutes} min {service.isActive ? "" : "· inativo"}
                  </option>
                ))}
              </select>
            </Field>

            {selectedService ? (
              <div className="grid grid-cols-2 gap-3 rounded-2xl border border-brand/20 bg-blue-50 p-4 shadow-sm">
                <div>
                  <p className="text-xs font-black uppercase text-brand/70">Duração</p>
                  <p className="text-sm font-black text-brand">{selectedService.durationMinutes} min</p>
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

            <div className="grid gap-3 sm:grid-cols-2">
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
          onReminder={openReminder}
          onComplete={(appointment) => updateStatus(appointment, "concluido")}
        />
      ) : null}

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
      <ReminderModal appointment={reminderAppointment} onClose={() => setReminderAppointment(null)} />
    </div>
  );
}
