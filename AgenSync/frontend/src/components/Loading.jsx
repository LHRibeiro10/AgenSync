export default function Loading({ label = "Carregando..." }) {
  return (
    <div className="skeleton-panel min-h-32 rounded-2xl border border-[#E2E8F0] bg-white/80 p-4 sm:min-h-[240px] sm:p-5" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="skeleton-line h-4 w-40 max-w-full rounded-full" />
          <p className="mt-3 text-sm font-bold text-muted">{label}</p>
        </div>
        <div className="skeleton-line h-10 w-10 shrink-0 rounded-xl" />
      </div>

      <div className="mt-5 grid gap-3">
        <div className="skeleton-line h-14 rounded-xl" />
        <div className="skeleton-line h-14 rounded-xl" />
        <div className="skeleton-line h-14 rounded-xl" />
      </div>
    </div>
  );
}
