function MetricCard({ label, value, tone = "brand" }) {
  const toneClass = tone === "success" ? "text-emerald-700" : "text-brand";

  return (
    <article className="rounded-2xl border border-line bg-white px-5 py-4 shadow-sm">
      <p className="text-[11px] font-black uppercase text-slate-500">{label}</p>
      <p className={`mt-3 text-2xl font-black ${toneClass}`}>{value}</p>
    </article>
  );
}

export default function WeekOverview({ weekLabel, metrics, onPreviousWeek, onNextWeek, onOpenWorkingHours }) {
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_140px]">
      <article className="relative min-h-[164px] rounded-2xl border border-line bg-white p-6 shadow-sm">
        <p className="text-[12px] font-black uppercase text-brand">Semana atual</p>
        <h2 className="mt-3 text-xl font-black text-ink">{weekLabel}</h2>

        <div className="absolute right-5 top-8 flex gap-2">
          <button
            type="button"
            onClick={onPreviousWeek}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-line bg-white text-lg font-black text-slate-500 transition hover:border-brand/40 hover:text-brand"
            aria-label="Semana anterior"
          >
            {"<"}
          </button>
          <button
            type="button"
            onClick={onNextWeek}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-line bg-white text-lg font-black text-slate-500 transition hover:border-brand/40 hover:text-brand"
            aria-label="Próxima semana"
          >
            {">"}
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenWorkingHours}
          className="mt-8 inline-flex h-10 items-center justify-center rounded-xl border border-line bg-slate-50 px-4 text-sm font-black text-ink transition hover:border-brand/40 hover:bg-blue-50 hover:text-brand"
        >
          Configurar horários
        </button>
      </article>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
        <MetricCard label="Atendimentos" value={metrics.appointments} />
        <MetricCard label="Dias úteis" value={metrics.businessDays} tone="success" />
        <MetricCard label="Receita" value={metrics.revenue} />
      </div>
    </section>
  );
}
