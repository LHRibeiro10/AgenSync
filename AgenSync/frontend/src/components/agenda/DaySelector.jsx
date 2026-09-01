export default function DaySelector({ days, selectedDate, onSelectDate }) {
  return (
    <section className="min-w-0 max-w-full rounded-2xl border border-line bg-white p-3 shadow-sm sm:p-5">
      <p className="text-[12px] font-black uppercase text-brand">Selecione um dia</p>
      <div className="mt-3 grid max-w-full grid-cols-7 gap-1.5 sm:mt-4 sm:flex sm:flex-wrap sm:gap-2">
        {days.map((day) => {
          const isSelected = selectedDate === day.date;

          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelectDate(day.date)}
              className={[
                "h-14 min-w-0 rounded-xl border px-1 text-center transition sm:h-16 sm:w-16 sm:rounded-2xl sm:px-3",
                isSelected
                  ? "border-brand bg-brand text-white shadow-[0_10px_20px_rgba(37,99,235,0.24)]"
                  : "border-line bg-white text-slate-600 hover:border-brand/40 hover:text-brand"
              ].join(" ")}
              aria-pressed={isSelected}
            >
              <span className="block text-[11px] font-black uppercase">{day.shortLabel}</span>
              <span className="mt-1 block text-sm font-black">{day.dayNumber}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
