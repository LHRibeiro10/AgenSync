import Button from "../Button.jsx";
import StatusBadge from "../StatusBadge.jsx";
import { money } from "../../utils.js";

function appointmentClient(appointment) {
  return appointment.client?.name || appointment.client || "Cliente";
}

function appointmentService(appointment) {
  return appointment.service?.name || appointment.service || "Serviço";
}

function appointmentProfessional(appointment) {
  return appointment.professional?.name || appointment.professional || "Profissional não informado";
}

export default function DayCard({ appointment, onOpen, onReschedule }) {
  const clientName = appointmentClient(appointment);
  const professionalName = appointmentProfessional(appointment);
  const serviceName = appointmentService(appointment);

  function stopAndOpen(event) {
    event.stopPropagation();
    onOpen(appointment);
  }

  function stopAndReschedule(event) {
    event.stopPropagation();
    onReschedule(appointment);
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(appointment)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen(appointment);
      }}
      className="cursor-pointer rounded-2xl border border-line bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-soft sm:p-5"
    >
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_260px_120px] lg:items-start">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-500">
            {appointment.startTime} - {appointment.endTime}
          </p>
          <h3 className="mt-2 text-base font-black text-ink sm:text-lg">{clientName}</h3>
          <p className="mt-1 text-sm font-semibold text-muted">{serviceName}</p>
          <p className="mt-1 text-sm font-semibold text-muted">Profissional: {professionalName}</p>
          <div className="mt-3 sm:mt-5">
            <p className="text-[11px] font-black uppercase text-slate-500">Valor</p>
            <p className="mt-1 text-sm font-black text-ink">{money(appointment.price)}</p>
          </div>
        </div>

        <div className="self-end lg:self-auto">
          <p className="mb-2 text-[11px] font-black uppercase text-slate-500 sm:mb-3">Ações rápidas</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={stopAndOpen}>
              Editar
            </Button>
            <Button size="sm" variant="secondary" onClick={stopAndReschedule}>
              Reagendar
            </Button>
          </div>
        </div>

        <div className="flex justify-end">
          <StatusBadge status={appointment.status} />
        </div>
      </div>
    </article>
  );
}
