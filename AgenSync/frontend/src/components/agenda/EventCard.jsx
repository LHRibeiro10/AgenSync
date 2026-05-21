import StatusBadge from "../StatusBadge.jsx";

const statusStyles = {
  agendado: "border-blue-200 bg-blue-50/95 text-slate-950 shadow-[0_8px_18px_rgba(37,99,235,0.14)]",
  concluido: "border-emerald-200 bg-emerald-50/95 text-emerald-950 shadow-[0_8px_18px_rgba(16,185,129,0.14)]",
  cancelado: "border-red-200 bg-red-50/95 text-red-900",
  nao_compareceu: "border-amber-200 bg-amber-50/95 text-amber-950"
};

function appointmentClient(appointment) {
  return appointment.client?.name || appointment.client || "Cliente";
}

function appointmentService(appointment) {
  return appointment.service?.name || appointment.service || "Serviço";
}

function appointmentProfessional(appointment) {
  return appointment.professional?.name || appointment.professional || "Profissional";
}

export default function EventCard({ appointment, style, compact = false, onClick }) {
  const clientName = appointmentClient(appointment);
  const professionalName = appointmentProfessional(appointment);
  const serviceName = appointmentService(appointment);

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => onClick(appointment)}
        className={[
          "absolute z-20 flex items-center overflow-hidden rounded-xl border px-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-soft focus-visible:z-30",
          statusStyles[appointment.status] || statusStyles.agendado
        ].join(" ")}
        style={style}
        title={`${clientName} - ${appointment.startTime}`}
        aria-label={`Editar atendimento de ${clientName} às ${appointment.startTime}`}
      >
        <span className="min-w-0 truncate text-xs font-black leading-none">{clientName}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onClick(appointment)}
      className={[
        "absolute left-3 right-3 z-20 overflow-hidden rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-soft focus-visible:z-30",
        statusStyles[appointment.status] || statusStyles.agendado
      ].join(" ")}
      style={style}
      aria-label={`Editar atendimento de ${clientName} às ${appointment.startTime}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-black">{clientName}</p>
        <StatusBadge status={appointment.status} />
      </div>
      <p className="mt-1 truncate text-xs font-bold text-slate-600">{serviceName}</p>
      <p className="mt-1 truncate text-xs font-bold text-slate-500">{professionalName}</p>
      <p className="mt-2 text-sm font-black text-slate-700">
        {appointment.startTime} - {appointment.endTime}
      </p>
    </button>
  );
}
