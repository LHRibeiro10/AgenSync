export default function Card({ children, className = "", as: Component = "section", ...props }) {
  return (
    <Component
      className={`min-w-0 max-w-full rounded-[28px] border border-line bg-panel/95 shadow-soft transition-shadow duration-200 hover:shadow-panel ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}

export function CardHeader({ title, description, action }) {
  return (
    <div className="flex min-w-0 max-w-full flex-col gap-2 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="min-w-0">
        <h2 className="text-base font-black tracking-tight text-ink sm:text-lg">{title}</h2>
        {description ? <p className="mt-1 text-xs leading-5 text-muted sm:text-sm sm:leading-6">{description}</p> : null}
      </div>
      {action ? <div className="min-w-0 shrink-0">{action}</div> : null}
    </div>
  );
}
