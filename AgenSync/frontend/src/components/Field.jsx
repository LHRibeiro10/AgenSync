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
  "min-w-0 max-w-full w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 focus:shadow-lg sm:px-4 sm:py-4";

export const readOnlyInputClass =
  "min-w-0 max-w-full w-full rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-3 text-sm font-black text-zinc-600";
