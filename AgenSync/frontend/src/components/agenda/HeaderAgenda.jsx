import Icon from "../Icon.jsx";

export default function HeaderAgenda({ viewMode, onViewModeChange, onOpenWorkingHours }) {
  const options = [
    { value: "week", label: "Visão Semanal", mobileHidden: true },
    { value: "day", label: "Visão Diária" }
  ];

  return (
    <header className="space-y-3 sm:space-y-5">
      <div className="flex items-center gap-3">
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

      <div className="flex flex-wrap gap-2 sm:gap-3">
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
