export default function Card({ children, className = "", as: Component = "section", ...props }) {
  return (
    <Component
      className={`min-w-0 max-w-full rounded-[28px] border border-white/80 bg-white/95 shadow-[0_24px_60px_rgba(15,23,42,0.08)] transition-shadow duration-200 hover:shadow-[0_32px_90px_rgba(15,23,42,0.12)] ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}

export function CardHeader({ title, description, action }) {
  return (
    <div className="flex min-w-0 max-w-full flex-col gap-2 border-b border-zinc-200/80 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="min-w-0">
        <h2 className="text-base font-black tracking-tight text-ink sm:text-lg">{title}</h2>
        {description ? <p className="mt-1 text-xs leading-5 text-muted sm:text-sm sm:leading-6">{description}</p> : null}
      </div>
      {action ? <div className="min-w-0 shrink-0">{action}</div> : null}
    </div>
  );
}
