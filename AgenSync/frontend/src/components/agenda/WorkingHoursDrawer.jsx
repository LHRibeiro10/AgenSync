import { useEffect, useState } from "react";
import Button from "../Button.jsx";
import { weekdayOptions } from "./agendaDate.js";

function updateDay(draft, weekday, field, value) {
  return {
    ...draft,
    [weekday]: {
      ...draft[weekday],
      [field]: value
    }
  };
}

export default function WorkingHoursDrawer({ open, workingHours, onClose, onSave }) {
  const [draft, setDraft] = useState(workingHours);

  useEffect(() => {
    if (open) setDraft(workingHours);
  }, [open, workingHours]);

  if (!open) return null;

  function handleSave() {
    onSave(draft);
    onClose();
  }

  return (
    <section className="working-hours-page flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <header className="flex shrink-0 flex-col gap-4 border-b border-line p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="min-w-0">
          <p className="text-[12px] font-black uppercase text-brand">Horarios de trabalho</p>
          <h2 className="mt-2 text-2xl font-black text-ink">Dias e expediente</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-muted">
            Defina quando a agenda fica aberta para criacao de atendimentos.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white px-4 text-sm font-black text-slate-600 transition hover:bg-slate-50"
        >
          Voltar para agenda
        </button>
      </header>

      <div className="working-hours-days-frame min-h-0 flex-1 overflow-hidden bg-white p-3 sm:p-5">
        <div className="working-hours-days-scroll min-h-0 space-y-3 pb-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
          {weekdayOptions.map((day) => {
            const value = draft[day.weekday];

            return (
              <section key={day.weekday} className="min-w-0 overflow-hidden rounded-2xl border border-line bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black capitalize text-ink">{day.label}</p>
                    <p className="mt-1 text-xs font-semibold text-muted">{value.enabled ? "Agenda aberta" : "Dia fechado"}</p>
                  </div>

                  <label className="inline-flex items-center gap-2 text-sm font-black text-ink">
                    <input
                      type="checkbox"
                      checked={value.enabled}
                      onChange={(event) => setDraft((current) => updateDay(current, day.weekday, "enabled", event.target.checked))}
                      className="h-5 w-5 rounded border-line text-brand focus:ring-brand/20"
                    />
                    Aberto
                  </label>
                </div>

                {value.enabled ? (
                  <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
                    <label className="block min-w-0">
                      <span className="text-xs font-black uppercase text-slate-500">Inicio</span>
                      <input
                        type="time"
                        value={value.startTime}
                        onChange={(event) => setDraft((current) => updateDay(current, day.weekday, "startTime", event.target.value))}
                        className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm font-bold text-ink shadow-sm"
                      />
                    </label>

                    <label className="block min-w-0">
                      <span className="text-xs font-black uppercase text-slate-500">Fim</span>
                      <input
                        type="time"
                        value={value.endTime}
                        onChange={(event) => setDraft((current) => updateDay(current, day.weekday, "endTime", event.target.value))}
                        className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm font-bold text-ink shadow-sm"
                      />
                    </label>

                    <label className="block min-w-0">
                      <span className="text-xs font-black uppercase text-slate-500">Pausa inicio</span>
                      <input
                        type="time"
                        value={value.breakStart}
                        onChange={(event) => setDraft((current) => updateDay(current, day.weekday, "breakStart", event.target.value))}
                        className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm font-bold text-ink shadow-sm"
                      />
                    </label>

                    <label className="block min-w-0">
                      <span className="text-xs font-black uppercase text-slate-500">Pausa fim</span>
                      <input
                        type="time"
                        value={value.breakEnd}
                        onChange={(event) => setDraft((current) => updateDay(current, day.weekday, "breakEnd", event.target.value))}
                        className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm font-bold text-ink shadow-sm"
                      />
                    </label>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>

      <footer className="grid shrink-0 grid-cols-2 gap-3 border-t border-line p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:p-5">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={handleSave}>Salvar horarios</Button>
      </footer>
    </section>
  );
}
