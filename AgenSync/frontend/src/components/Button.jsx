const variants = {
  primary:
    "border-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_16px_32px_rgba(37,99,235,0.24)] hover:shadow-[0_20px_40px_rgba(37,99,235,0.32)] hover:from-blue-700 hover:to-indigo-700 disabled:hover:from-blue-600 disabled:hover:to-indigo-600",
  secondary:
    "border border-slate-200 bg-white text-ink shadow-sm hover:border-blue-200 hover:bg-blue-50 hover:text-brand",
  ghost: "text-muted hover:bg-zinc-100 hover:text-ink",
  dark:
    "border border-white/10 bg-white/10 text-white shadow-sm hover:border-white/20 hover:bg-white/15",
  danger:
    "border border-red-200 bg-red-50 text-danger hover:border-red-300 hover:bg-red-100",
  success:
    "border border-green-200 bg-green-50 text-success hover:border-green-300 hover:bg-green-100"
};

const sizes = {
  sm: "min-h-9 px-3 text-sm sm:min-h-10",
  md: "min-h-11 px-3 text-sm sm:min-h-12 sm:px-4",
  lg: "min-h-12 px-4 text-sm sm:min-h-14 sm:px-5 sm:text-base"
};

export default function Button({
  children,
  className = "",
  variant = "primary",
  size = "md",
  loading = false,
  loadingLabel = "Salvando...",
  disabled = false,
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={[
        "inline-flex max-w-full items-center justify-center gap-2 rounded-xl font-bold transition duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:translate-y-0 disabled:scale-100 disabled:opacity-60",
        variants[variant],
        sizes[size],
        className
      ].join(" ")}
      {...props}
    >
      {loading ? loadingLabel : children}
    </button>
  );
}
