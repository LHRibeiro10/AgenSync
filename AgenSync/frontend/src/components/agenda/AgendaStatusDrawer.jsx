import { useEffect, useState } from "react";
import Button from "../Button.jsx";
import StatusBadge from "../StatusBadge.jsx";
import { money, statusOptions } from "../../utils.js";

function appointmentClient(appointment) {
  return appointment.client?.name || appointment.client || "Cliente";
}

function appointmentService(appointment) {
  return appointment.service?.name || appointment.service || "Serviço";
}

function appointmentProfessional(appointment) {
  return appointment.professional?.name || appointment.professional || "Profissional não informado";
}

export default function AgendaStatusDrawer({
  appointment,
  open,
  saving,
  onClose,
  onEdit,
  onReschedule,
  onReminder,
  onSaveStatus,
  onDelete
}) {
  const [draftStatus, setDraftStatus] = useState(appointment?.status || "agendado");

  useEffect(() => {
    if (appointment) setDraftStatus(appointment.status);
  }, [appointment]);

  if (!open || !appointment) return null;

  const clientName = appointmentClient(appointment);
  const professionalName = appointmentProfessional(appointment);
  const serviceName = appointmentService(appointment);
  const hasStatusChange = draftStatus !== appointment.status;

  return (
    <div
      className="agensync-overlay z-50 bg-slate-950/35 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        className="agensync-drawer-panel ml-auto flex w-full max-w-[430px] flex-col bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="shrink-0 flex items-start justify-between gap-4 border-b border-line p-4 sm:p-5">
          <div>
            <p className="text-xs font-black uppercase text-brand">Atendimento</p>
            <h2 className="mt-2 text-2xl font-black text-ink">{clientName}</h2>
            <p className="mt-1 text-sm font-semibold text-muted">{serviceName}</p>
            <p className="mt-1 text-sm font-semibold text-muted">Profissional: {professionalName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white text-lg font-black text-slate-500 transition hover:bg-slate-50"
            aria-label="Fechar painel"
          >
            X
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <section className="rounded-2xl border border-line bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-slate-500">Horário</p>
                <p className="mt-1 text-xl font-black text-ink">
                  {appointment.startTime} - {appointment.endTime}
                </p>
                <p className="mt-1 text-sm font-bold text-muted">{appointment.date}</p>
              </div>
              <StatusBadge status={appointment.status} />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-black uppercase text-slate-500">Valor</p>
                <p className="mt-1 text-sm font-black text-success">{money(appointment.price)}</p>
              </div>
              <div>
                <p className="text-xs font-black uppercase text-slate-500">Profissional</p>
                <p className="mt-1 text-sm font-black text-ink">{professionalName}</p>
              </div>
              <div>
                <p className="text-xs font-black uppercase text-slate-500">Status atual</p>
                <p className="mt-1 text-sm font-black text-ink">
                  {statusOptions.find((option) => option.value === appointment.status)?.label || appointment.status}
                </p>
              </div>
            </div>
          </section>

          <section className="mt-4 rounded-2xl border border-line bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-slate-500">Alterar status</p>
                <p className="mt-1 text-xs font-bold text-muted">Escolha o status e confirme em salvar alterações.</p>
              </div>
              {hasStatusChange ? (
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black uppercase text-brand ring-1 ring-blue-100">
                  Alterado
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid gap-2">
              {statusOptions.map((status) => {
                const selected = status.value === draftStatus;
                const current = status.value === appointment.status;

                return (
                  <button
                    key={status.value}
                    type="button"
                    disabled={saving}
                    onClick={() => setDraftStatus(status.value)}
                    className={[
                      "flex min-h-11 items-center justify-between rounded-xl border px-4 text-sm font-black transition disabled:cursor-not-allowed",
                      selected
                        ? "border-brand bg-blue-50 text-brand"
                        : "border-line bg-white text-ink hover:border-brand/40 hover:bg-blue-50 hover:text-brand",
                      saving ? "opacity-70" : ""
                    ].join(" ")}
                    aria-pressed={selected}
                  >
                    {status.label}
                    {current ? <span className="text-xs uppercase">Atual</span> : selected ? <span className="text-xs uppercase">Selecionado</span> : null}
                  </button>
                );
              })}
            </div>
          </section>

          {appointment.notes ? (
            <section className="mt-4 rounded-2xl border border-line bg-white p-4">
              <p className="text-xs font-black uppercase text-slate-500">Observações</p>
              <p className="mt-2 text-sm leading-6 text-muted">{appointment.notes}</p>
            </section>
          ) : null}
        </div>

        <footer className="shrink-0 grid gap-3 border-t border-line p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:p-5">
          <Button onClick={() => onSaveStatus(draftStatus)} loading={saving} disabled={!hasStatusChange}>
            Salvar alterações
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => onEdit(appointment)}>
              Editar
            </Button>
            <Button variant="secondary" onClick={() => onReschedule(appointment)}>
              Reagendar
            </Button>
          </div>
          <Button variant="secondary" onClick={() => onReminder?.(appointment)}>
            Enviar lembrete
          </Button>
          <Button variant="danger" onClick={() => onDelete(appointment)} disabled={saving}>
            Excluir agendamento
          </Button>
        </footer>
      </aside>
    </div>
  );
}
