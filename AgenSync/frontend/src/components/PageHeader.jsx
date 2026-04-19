export default function PageHeader({ title, description, action }) {
  return (
    <div className="flex min-w-0 max-w-full flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-4xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-xs leading-5 text-muted sm:mt-2 sm:text-sm sm:leading-6">{description}</p> : null}
      </div>
      {action ? <div className="min-w-0 shrink-0">{action}</div> : null}
    </div>
  );
}
