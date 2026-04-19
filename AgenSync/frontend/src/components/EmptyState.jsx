export default function EmptyState({ title, description, action }) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center px-4 py-6 text-center sm:min-h-48 sm:px-6 sm:py-10">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-lg font-black text-brand sm:mb-4 sm:h-12 sm:w-12 sm:text-xl">
        A
      </div>
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {description ? <p className="mt-2 max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
