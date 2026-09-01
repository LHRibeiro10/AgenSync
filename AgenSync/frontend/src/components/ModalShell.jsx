export default function ModalShell({ title, description, onClose, children, footer, wide = false }) {
  return (
    <div
      className="agensync-overlay z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-white shadow-panel sm:max-h-[88vh] sm:rounded-3xl ${
          wide ? "sm:max-w-2xl" : "sm:max-w-lg"
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line p-4 sm:p-5">
          <div className="min-w-0">
            <h2 className="text-lg font-black text-ink">{title}</h2>
            {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-black text-muted transition hover:bg-slate-100 hover:text-ink"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
        {footer ? <div className="shrink-0 border-t border-line p-4 sm:p-5">{footer}</div> : null}
      </div>
    </div>
  );
}

export function FormSection({ title, children }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-brand">{title}</p>
      {children}
    </div>
  );
}
