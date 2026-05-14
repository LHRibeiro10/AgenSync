export default function Message({ type = "info", children, actionLabel = "", onAction }) {
  if (!children) return null;

  const styles =
    type === "error"
      ? "border-red-200 bg-red-50 text-danger"
    : type === "success"
      ? "border-green-200 bg-green-50 text-success"
      : "border-line bg-panel text-muted";

  return (
    <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${styles}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">{children}</div>
        {actionLabel && typeof onAction === "function" ? (
          <button
            type="button"
            onClick={onAction}
            className="rounded-lg border border-current/30 px-2.5 py-1 text-xs font-black transition hover:bg-white/60"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
