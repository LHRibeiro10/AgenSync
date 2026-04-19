import EmptyState from "../EmptyState.jsx";
import Loading from "../Loading.jsx";
import StatusBadge from "../StatusBadge.jsx";
import { money } from "../../utils.js";

export default function HistoryTab({ appointments, loading }) {
  if (loading) return <Loading label="Carregando histórico..." />;

  if (!appointments.length) {
    return <EmptyState title="Nenhum atendimento" description="Os agendamentos desse cliente aparecem aqui." />;
  }

  return (
    <div className="divide-y divide-[#E2E8F0] overflow-hidden rounded-xl border border-[#E2E8F0]">
      {appointments.map((appointment) => (
        <article key={appointment.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-black text-ink">{appointment.service?.name || "Serviço"}</p>
              <StatusBadge status={appointment.status} />
            </div>
            <p className="mt-1 text-sm font-medium text-muted">
              {appointment.date} · {appointment.startTime} até {appointment.endTime}
            </p>
            {appointment.notes ? <p className="mt-2 text-sm text-muted">{appointment.notes}</p> : null}
          </div>
          <p className="text-left text-lg font-black text-success sm:text-right">{money(appointment.price)}</p>
        </article>
      ))}
    </div>
  );
}
