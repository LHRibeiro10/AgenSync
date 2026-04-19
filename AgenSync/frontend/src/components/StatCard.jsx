import Icon from "./Icon.jsx";
import { Link } from "react-router-dom";

const tones = {
  default: {
    icon: "dashboard",
    iconClass: "bg-[#DBEAFE] text-brand",
    valueClass: "text-ink",
    glow: "hover:border-brand/25"
  },
  leaf: {
    icon: "finance",
    iconClass: "bg-[#D1FAE5] text-success",
    valueClass: "text-success",
    glow: "hover:border-green-200"
  },
  expense: {
    icon: "expenses",
    iconClass: "bg-red-50 text-red-600",
    valueClass: "text-red-600",
    glow: "hover:border-red-200"
  },
  blue: {
    icon: "agenda",
    iconClass: "bg-[#DBEAFE] text-brand",
    valueClass: "text-brand",
    glow: "hover:border-blue-200"
  }
};

export default function StatCard({ label, value, detail, tone = "default", icon, to }) {
  const theme = tones[tone] || tones.default;

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">{label}</p>
          <strong className={`mt-2 block text-2xl font-extrabold tracking-tight sm:text-[28px] ${theme.valueClass}`}>{value}</strong>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition duration-200 group-hover:scale-105 ${theme.iconClass}`}>
          <Icon name={icon || theme.icon} className="h-5 w-5" />
        </div>
      </div>
      {detail ? <span className="mt-3 block truncate rounded-xl bg-white/70 px-3 py-2 text-xs font-bold text-muted ring-1 ring-slate-200/70">{detail}</span> : null}
    </>
  );

  const className = `group block min-h-[132px] cursor-pointer rounded-2xl border border-[#E2E8F0] bg-white/90 p-4 shadow-soft transition duration-200 hover:-translate-y-1 hover:bg-white hover:shadow-panel focus:outline-none focus:ring-4 focus:ring-brand/10 active:scale-[0.99] ${theme.glow}`;

  if (to) {
    return (
      <Link to={to} className={className} aria-label={`Abrir ${label}`}>
        {content}
      </Link>
    );
  }

  return (
    <article className={className}>
      {content}
    </article>
  );
}
