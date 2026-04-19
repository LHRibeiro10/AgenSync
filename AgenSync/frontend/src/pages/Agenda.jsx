import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import AgendaStatusDrawer from "../components/agenda/AgendaStatusDrawer.jsx";
import CalendarGrid from "../components/agenda/CalendarGrid.jsx";
import DayCard from "../components/agenda/DayCard.jsx";
import DaySelector from "../components/agenda/DaySelector.jsx";
import HeaderAgenda from "../components/agenda/HeaderAgenda.jsx";
import WeekOverview from "../components/agenda/WeekOverview.jsx";
import WorkingHoursDrawer from "../components/agenda/WorkingHoursDrawer.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { addDays, buildWeekDays, formatDateKey, formatWeekLabel, parseDateKey, startOfWeek } from "../components/agenda/agendaDate.js";
import { appointmentsForDate, buildTimeRows, minutesToTime, timeToMinutes } from "../components/agenda/agendaTime.js";
import Loading from "../components/Loading.jsx";
import Message from "../components/Message.jsx";
import { useToast } from "../components/Toast.jsx";
import { agendaSchedule, defaultWorkingHours } from "../data/agendaConfig.js";
import { todayInputValue } from "../utils.js";

const workingHoursStorageKey = "agensync_working_hours_v1";

const revenueFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0
});

function cloneWorkingHours(value) {
  return Object.fromEntries(Object.entries(value).map(([weekday, hours]) => [weekday, { ...hours }]));
}

function normalizeWorkingHours(value) {
  const incoming = value && typeof value === "object" ? value : {};

  return Object.fromEntries(
    Object.entries(defaultWorkingHours).map(([weekday, fallback]) => [
      weekday,
      {
        ...fallback,
        ...(incoming[weekday] || {})
      }
    ])
  );
}

function loadWorkingHours() {
  try {
    const saved = localStorage.getItem(workingHoursStorageKey);
    return normalizeWorkingHours(saved ? JSON.parse(saved) : defaultWorkingHours);
  } catch {
    return cloneWorkingHours(defaultWorkingHours);
  }
}

function getVisibleSchedule(days, appointments) {
  const blocks = [];

  days.forEach((day) => {
    if (!day.isClosed && timeToMinutes(day.workingHours.startTime) < timeToMinutes(day.workingHours.endTime)) {
      blocks.push({
        startTime: day.workingHours.startTime,
        endTime: day.workingHours.endTime
      });
    }
  });

  appointments.forEach((appointment) => {
    blocks.push({
      startTime: appointment.startTime,
      endTime: appointment.endTime
    });
  });

  if (!blocks.length) return agendaSchedule;

  return {
    ...agendaSchedule,
    startsAt: minutesToTime(Math.min(...blocks.map((block) => timeToMinutes(block.startTime)))),
    endsAt: minutesToTime(Math.max(...blocks.map((block) => timeToMinutes(block.endTime))))
  };
}

function getBreaksForWeek(days) {
  return days.flatMap((day) => {
    const hours = day.workingHours;
    const hasBreak = hours?.enabled && hours.breakStart && hours.breakEnd && timeToMinutes(hours.breakStart) < timeToMinutes(hours.breakEnd);

    if (!hasBreak) return [];

    return [
      {
        date: day.date,
        startTime: hours.breakStart,
        endTime: hours.breakEnd,
        label: "Pausa"
      }
    ];
  });
}

export default function Agenda() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const initialSelectedDate = todayInputValue();
  const [viewMode, setViewMode] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches ? "day" : "week"
  );
  const [weekStart, setWeekStart] = useState(() => startOfWeek(parseDateKey(initialSelectedDate)));
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusSaving, setStatusSaving] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [workingHours, setWorkingHours] = useState(loadWorkingHours);
  const [workingHoursOpen, setWorkingHoursOpen] = useState(false);

  const weekDays = useMemo(() => buildWeekDays(weekStart, workingHours), [weekStart, workingHours]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const weekLabel = useMemo(() => formatWeekLabel(weekDays), [weekDays]);
  const visibleSchedule = useMemo(() => getVisibleSchedule(weekDays, appointments), [weekDays, appointments]);
  const timeRows = useMemo(
    () => buildTimeRows(visibleSchedule.startsAt, visibleSchedule.endsAt, visibleSchedule.slotMinutes),
    [visibleSchedule]
  );
  const weekBreaks = useMemo(() => getBreaksForWeek(weekDays), [weekDays]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const media = window.matchMedia("(max-width: 1023px)");
    const syncMobileView = () => {
      if (media.matches) setViewMode("day");
    };

    syncMobileView();
    media.addEventListener("change", syncMobileView);
    return () => media.removeEventListener("change", syncMobileView);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadWeekAppointments() {
      setLoading(true);
      setError("");

      try {
        const data = await api.listAppointments({
          startDate: formatDateKey(weekStart),
          endDate: formatDateKey(weekEnd)
        });

        if (active) setAppointments(data.appointments);
      } catch (err) {
        if (active) {
          setAppointments([]);
          setError(err.message);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadWeekAppointments();

    return () => {
      active = false;
    };
  }, [weekStart, weekEnd, reloadKey]);

  const metrics = useMemo(() => {
    const revenue = appointments
      .filter((appointment) => appointment.status === "concluido")
      .reduce((total, appointment) => total + Number(appointment.price || 0), 0);

    return {
      appointments: appointments.length,
      businessDays: weekDays.filter((day) => !day.isClosed).length,
      revenue: revenueFormatter.format(revenue)
    };
  }, [appointments, weekDays]);

  const selectedDay = weekDays.find((day) => day.date === selectedDate) || weekDays[0];
  const selectedAppointments = appointmentsForDate(appointments, selectedDate);
  const showDaily = viewMode === "day";

  function changeWeek(amount) {
    const selectedIndex = Math.max(weekDays.findIndex((day) => day.date === selectedDate), 0);
    const nextWeekStart = addDays(weekStart, amount * 7);

    setWeekStart(nextWeekStart);
    setSelectedDate(formatDateKey(addDays(nextWeekStart, selectedIndex)));
    setSelectedAppointment(null);
  }

  function openAppointment(appointment) {
    setSelectedDate(appointment.date);
    setSelectedAppointment(appointment);
  }

  function editAppointment(appointment) {
    navigate(`/agendamentos?editar=${appointment.id}`, {
      state: { appointmentId: appointment.id, intent: "edit" }
    });
  }

  function rescheduleAppointment(appointment) {
    navigate(`/agendamentos?editar=${appointment.id}&acao=reagendar`, {
      state: { appointmentId: appointment.id, intent: "reschedule" }
    });
  }

  function createAppointment(date, startTime) {
    navigate(`/agendamentos?data=${date}&hora=${startTime}`, {
      state: { prefill: { date, startTime } }
    });
  }

  function openCreateForSelectedDay() {
    createAppointment(selectedDate, selectedDay.workingHours?.startTime || visibleSchedule.startsAt);
  }

  function saveWorkingHours(nextWorkingHours) {
    const normalized = normalizeWorkingHours(nextWorkingHours);
    setWorkingHours(normalized);
    localStorage.setItem(workingHoursStorageKey, JSON.stringify(normalized));
  }

  async function saveAppointmentStatus(status) {
    if (!selectedAppointment) return;

    setStatusSaving(true);
    setError("");

    try {
      const data = await api.updateAppointment(selectedAppointment.id, { status });
      const updated = data.appointment;

      setAppointments((current) =>
        current.map((appointment) => (appointment.id === updated.id ? updated : appointment))
      );
      setSelectedAppointment(updated);
      showToast("Status atualizado.");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setStatusSaving(false);
    }
  }

  async function confirmDeleteAppointment() {
    if (!pendingDelete) return;

    setStatusSaving(true);
    setError("");

    try {
      await api.deleteAppointment(pendingDelete.id);
      setAppointments((current) => current.filter((appointment) => appointment.id !== pendingDelete.id));
      if (selectedAppointment?.id === pendingDelete.id) setSelectedAppointment(null);
      setPendingDelete(null);
      showToast("Agendamento excluído.");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setStatusSaving(false);
    }
  }

  return (
    <div className={workingHoursOpen ? "min-h-0" : "space-y-4 sm:space-y-6"}>
      {workingHoursOpen ? (
        <WorkingHoursDrawer
          open={workingHoursOpen}
          workingHours={workingHours}
          onClose={() => setWorkingHoursOpen(false)}
          onSave={saveWorkingHours}
        />
      ) : (
        <>
          <HeaderAgenda
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onOpenWorkingHours={() => setWorkingHoursOpen(true)}
          />

          <Message type="error" actionLabel="Tentar novamente" onAction={() => setReloadKey((value) => value + 1)}>
            {error}
          </Message>

          <div className={showDaily ? "hidden" : "hidden lg:block"}>
            <div className="space-y-5">
              <WeekOverview
                weekLabel={weekLabel}
                metrics={metrics}
                onPreviousWeek={() => changeWeek(-1)}
                onNextWeek={() => changeWeek(1)}
                onOpenWorkingHours={() => setWorkingHoursOpen(true)}
              />

              {loading ? (
                <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-line bg-white shadow-sm">
                  <Loading label="Carregando agenda..." />
                </div>
              ) : (
                <CalendarGrid
                  days={weekDays}
                  appointments={appointments}
                  breaks={weekBreaks}
                  rows={timeRows}
                  schedule={visibleSchedule}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  onSlotClick={createAppointment}
                  onEventClick={openAppointment}
                />
              )}
            </div>
          </div>

          <div className={showDaily ? "block" : "block lg:hidden"}>
            <section className="space-y-3 sm:space-y-5">
              <DaySelector
                days={weekDays}
                appointments={appointments}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />

              <section className="rounded-2xl border border-line bg-white p-3 shadow-sm sm:p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-base font-black text-ink sm:text-lg">{selectedDay.longLabel}</h2>
                  {!selectedDay.isClosed ? (
                    <button
                      type="button"
                      onClick={openCreateForSelectedDay}
                      className="inline-flex h-9 items-center justify-center rounded-xl bg-brand px-3 text-sm font-black text-white shadow-[0_10px_20px_rgba(37,99,235,0.18)] transition hover:bg-brand-dark sm:h-10 sm:px-4"
                    >
                      Criar agendamento
                    </button>
                  ) : null}
                </div>

                <div className="mt-3 space-y-3 sm:mt-5 sm:space-y-4">
                  {loading ? (
                    <div className="flex min-h-32 items-center justify-center">
                      <Loading label="Carregando atendimentos..." />
                    </div>
                  ) : selectedDay.isClosed ? (
                    <div className="flex min-h-32 w-full items-center justify-center rounded-2xl border border-line bg-slate-100 px-5 text-sm font-black uppercase text-slate-500">
                      Fechado
                    </div>
                  ) : selectedAppointments.length ? (
                    selectedAppointments.map((appointment) => (
                      <DayCard
                        key={appointment.id}
                        appointment={appointment}
                        onOpen={openAppointment}
                        onReschedule={rescheduleAppointment}
                      />
                    ))
                  ) : (
                    <div className="flex min-h-24 w-full items-center justify-center rounded-2xl border border-dashed border-line bg-slate-50 px-5 text-sm font-black text-muted">
                      Nenhum agendamento para este dia
                    </div>
                  )}
                </div>
              </section>
            </section>
          </div>
        </>
      )}

      <AgendaStatusDrawer
        open={Boolean(selectedAppointment)}
        appointment={selectedAppointment}
        saving={statusSaving}
        onClose={() => setSelectedAppointment(null)}
        onEdit={editAppointment}
        onReschedule={rescheduleAppointment}
        onSaveStatus={saveAppointmentStatus}
        onDelete={setPendingDelete}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Excluir agendamento?"
        description={
          pendingDelete
            ? `${pendingDelete.client?.name || "Este cliente"} será removido da agenda em ${pendingDelete.date} às ${pendingDelete.startTime}.`
            : ""
        }
        confirmLabel="Excluir"
        danger
        onConfirm={confirmDeleteAppointment}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
