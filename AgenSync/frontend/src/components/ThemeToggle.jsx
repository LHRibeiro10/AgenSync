import { useTheme } from "../contexts/ThemeContext.jsx";
import Icon from "./Icon.jsx";

export default function ThemeToggle({ compact = false, className = "" }) {
  const { isDark, toggleTheme } = useTheme();

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-line bg-panel text-ink shadow-sm transition hover:border-brand/35 hover:bg-brand/10 hover:text-brand active:scale-95 ${className}`}
        aria-label={isDark ? "Ativar modo claro" : "Ativar modo noturno"}
        title={isDark ? "Modo claro" : "Modo noturno"}
      >
        <Icon name={isDark ? "sun" : "moon"} className="h-5 w-5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`group flex w-full items-center justify-between gap-3 rounded-2xl border border-line bg-panel-muted p-3 text-left transition hover:border-brand/35 hover:bg-brand/10 ${className}`}
      aria-pressed={isDark}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Icon name={isDark ? "moon" : "sun"} className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-black text-ink">Modo noturno</span>
          <span className="block text-xs font-semibold text-muted">{isDark ? "Ativo" : "Desativado"}</span>
        </span>
      </span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full border transition ${
          isDark ? "border-brand/40 bg-brand" : "border-line bg-panel"
        }`}
      >
        <span
          className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-sm transition ${
            isDark ? "left-6" : "left-1"
          }`}
        />
      </span>
    </button>
  );
}
