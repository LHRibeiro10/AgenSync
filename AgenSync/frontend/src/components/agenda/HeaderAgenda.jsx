import { useRef, useState } from "react";
import Icon from "../Icon.jsx";

export default function HeaderAgenda({
  viewMode,
  onViewModeChange,
  onOpenWorkingHours,
  monthYearLabel,
  appointmentsCount = 0,
  selectedDate,
  onPreviousWeek,
  onNextWeek,
  onJumpToDate
}) {
  const options = [
    { value: "week", label: "Visão Semanal", mobileHidden: true },
    { value: "day", label: "Visão Diária" }
  ];
  const [menuOpen, setMenuOpen] = useState(false);
  const dateInputRef = useRef(null);

  function openDatePicker() {
    const input = dateInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
        return;
      } catch {
        // fall through to focus
      }
    }
    input.focus();
  }

  return (
    <header className="space-y-3 sm:space-y-5">
      <div className="hidden items-center gap-3 lg:flex">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-[0_12px_24px_rgba(37,99,235,0.24)] sm:h-12 sm:w-12">
          <Icon name="agenda" className="h-5 w-5 sm:h-6 sm:w-6" />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-black text-ink sm:text-3xl">Agenda de Atendimentos</h1>
          <p className="mt-0.5 text-xs font-semibold text-muted sm:mt-1 sm:text-sm">
            Gerencie seus horários e atendimentos da semana
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-white p-2 shadow-sm lg:hidden">
        <button
          type="button"
          onClick={onPreviousWeek}
          aria-label="Semana anterior"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-black text-ink transition hover:bg-slate-50"
        >
          ‹
        </button>

        <button
          type="button"
          onClick={openDatePicker}
          className="flex min-w-0 flex-1 flex-col items-center rounded-xl px-2 py-1 text-center transition hover:bg-slate-50"
        >
          <span className="truncate text-sm font-black capitalize text-ink">{monthYearLabel}</span>
          <span className="truncate text-[11px] font-semibold text-muted">
            {appointmentsCount} agendamento{appointmentsCount === 1 ? "" : "s"}
          </span>
          <input
            ref={dateInputRef}
            type="date"
            value={selectedDate || ""}
            onChange={(event) => {
              if (event.target.value) onJumpToDate?.(event.target.value);
            }}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />
        </button>

        <button
          type="button"
          onClick={onNextWeek}
          aria-label="Próxima semana"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg font-black text-ink transition hover:bg-slate-50"
        >
          ›
        </button>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            aria-label="Mais opções da agenda"
            aria-expanded={menuOpen}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-black text-ink transition hover:bg-slate-50"
          >
            ⋮
          </button>

          {menuOpen ? (
            <>
              <button
                type="button"
                aria-label="Fechar menu"
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-12 z-50 w-52 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-panel">
                <button
                  type="button"
                  onClick={() => {
                    onViewModeChange("day");
                    setMenuOpen(false);
                  }}
                  className="block w-full px-4 py-2.5 text-left text-sm font-bold text-ink transition hover:bg-slate-50"
                >
                  Visão Diária
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onOpenWorkingHours();
                    setMenuOpen(false);
                  }}
                  className="block w-full px-4 py-2.5 text-left text-sm font-bold text-ink transition hover:bg-slate-50"
                >
                  Horários de trabalho
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="hidden flex-wrap gap-2 sm:gap-3 lg:flex">
        <div className="inline-flex rounded-2xl border border-line bg-white p-1 shadow-sm">
          {options.map((option) => {
            const isActive = viewMode === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onViewModeChange(option.value)}
                className={[
                  "h-8 rounded-xl px-3 text-xs font-black transition sm:h-9",
                  option.mobileHidden ? "hidden lg:inline-flex lg:items-center" : "",
                  isActive ? "bg-white text-ink shadow-[inset_0_0_0_1px_rgba(17,24,39,0.18)]" : "text-slate-600 hover:bg-slate-50"
                ].join(" ")}
                aria-pressed={isActive}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onOpenWorkingHours}
          className="h-10 rounded-2xl border border-line bg-white px-3 text-xs font-black text-ink shadow-sm transition hover:border-brand/40 hover:bg-blue-50 hover:text-brand sm:h-11 sm:px-4"
        >
          Horários de trabalho
        </button>
      </div>
    </header>
  );
}
