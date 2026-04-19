export default function TimeColumn({ rows, slotHeight }) {
  return (
    <aside className="border-r border-line bg-slate-50">
      {rows.map((row) => (
        <div
          key={row.value}
          className="flex items-center justify-end border-b border-line px-3 text-[12px] font-semibold text-slate-500"
          style={{ height: `${slotHeight}px` }}
        >
          {row.label}
        </div>
      ))}
    </aside>
  );
}
