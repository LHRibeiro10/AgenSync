export default function WeekHeader({ days, selectedDate, onSelectDate }) {
  return (
    <div className="grid grid-cols-[84px_repeat(7,minmax(142px,1fr))] border-b border-line bg-slate-50">
      <span className="border-r border-line" aria-hidden="true" />

      {days.map((day) => {
        const isSelected = selectedDate === day.date;

        return (
          <button
            key={day.date}
            type="button"
            onClick={() => onSelectDate(day.date)}
            className={[
              "min-h-[86px] border-r border-line px-3 py-3 text-center transition last:border-r-0 hover:bg-white",
              isSelected ? "bg-white" : ""
            ].join(" ")}
            aria-pressed={isSelected}
          >
            <span className="block text-[11px] font-black uppercase text-slate-500">
              {day.shortLabel} {day.dayNumber}
            </span>
            <span className="mt-2 block text-sm font-bold text-ink">{day.monthLabel}</span>
            {day.isClosed ? (
              <span className="mx-auto mt-2 flex max-w-[110px] justify-center rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase text-slate-500">
                Fechado
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
