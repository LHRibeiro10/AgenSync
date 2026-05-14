export default function Field({ label, hint, children, className = "" }) {
  return (
    <label className={`block min-w-0 max-w-full ${className}`}>
      <span className="text-xs font-black text-ink sm:text-sm">{label}</span>
      <div className="mt-1 min-w-0 max-w-full">{children}</div>
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "min-w-0 max-w-full w-full rounded-2xl border border-line bg-panel-muted px-3 py-3 text-sm font-semibold text-ink shadow-sm transition-all duration-200 placeholder:text-muted/70 hover:border-brand/30 focus:border-brand focus:ring-4 focus:ring-brand/15 focus:shadow-lg sm:px-4 sm:py-4";

export const readOnlyInputClass =
  "min-w-0 max-w-full w-full rounded-xl border border-line bg-panel-muted px-3 py-3 text-sm font-black text-muted";
