import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Button from "./Button.jsx";
import Field, { inputClass } from "./Field.jsx";

export const periodOptions = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "thisWeek", label: "Esta semana" },
  { value: "last7", label: "Últimos 7 dias" },
  { value: "thisMonth", label: "Este mês" },
  { value: "last30", label: "Últimos 30 dias" },
  { value: "custom", label: "Personalizado" }
];

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric"
});

function parseDate(value) {
  return new Date(`${value}T00:00:00`);
}

function formatInputDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function rangeForPeriod(period, baseDate = new Date()) {
  const today = parseDate(formatInputDate(baseDate));

  if (period === "yesterday") {
    const yesterday = addDays(today, -1);
    return { startDate: formatInputDate(yesterday), endDate: formatInputDate(yesterday) };
  }

  if (period === "thisWeek") {
    return { startDate: formatInputDate(startOfWeek(today)), endDate: formatInputDate(today) };
  }

  if (period === "last7") {
    return { startDate: formatInputDate(addDays(today, -6)), endDate: formatInputDate(today) };
  }

  if (period === "thisMonth") {
    return { startDate: formatInputDate(startOfMonth(today)), endDate: formatInputDate(today) };
  }

  if (period === "last30") {
    return { startDate: formatInputDate(addDays(today, -29)), endDate: formatInputDate(today) };
  }

  return { startDate: formatInputDate(today), endDate: formatInputDate(today) };
}

export function periodLabel({ period, startDate, endDate }) {
  const option = periodOptions.find((item) => item.value === period);
  const start = startDate ? dateFormatter.format(parseDate(startDate)).replace(".", "") : "";
  const end = endDate ? dateFormatter.format(parseDate(endDate)).replace(".", "") : "";

  if (!startDate || !endDate) return option?.label || "Período";
  if (startDate === endDate) return `${option?.label || "Período"} · ${start}`;
  return `${option?.label || "Período"} · ${start} até ${end}`;
}

export default function FilterBar({
  title = "Filtros",
  description,
  period,
  startDate,
  endDate,
  onPeriodChange,
  onStartDateChange,
  onEndDateChange,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar por nome",
  statusValue,
  onStatusChange,
  statusOptions = [],
  categoryValue,
  onCategoryChange,
  categoryOptions = [],
  clientValue,
  onClientChange,
  clientOptions = [],
  productValue,
  onProductChange,
  productOptions = [],
  onSubmit,
  onClear,
  resultLabel
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isCustom = period === "custom";

  useEffect(() => {
    if (!mobileOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit?.();
    setMobileOpen(false);
  }

  function handleClear() {
    onClear?.();
    setMobileOpen(false);
  }

  function handlePeriodChange(value) {
    if (value === "custom") {
      onPeriodChange?.(value);
      return;
    }

    const next = rangeForPeriod(value);
    onPeriodChange?.(value);
    onStartDateChange?.(next.startDate);
    onEndDateChange?.(next.endDate);
  }

  function renderFields(mobile = false, includeActions = true) {
    return (
      <div className={mobile ? "grid gap-2" : "mt-4 grid gap-3 lg:grid-cols-12"}>
        <Field label="Período" className={mobile ? "" : "lg:col-span-3"}>
          <select value={period} onChange={(event) => handlePeriodChange(event.target.value)} className={inputClass}>
            {periodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <div className={mobile ? "grid gap-2 sm:grid-cols-2" : "contents"}>
          <Field label="Data inicial" className={mobile ? "" : "lg:col-span-2"}>
            <input
              type="date"
              value={startDate}
              onChange={(event) => onStartDateChange?.(event.target.value)}
              disabled={!isCustom}
              className={`${inputClass} disabled:bg-[#F8FAFC] disabled:text-slate-500`}
            />
          </Field>

          <Field label="Data final" className={mobile ? "" : "lg:col-span-2"}>
            <input
              type="date"
              value={endDate}
              onChange={(event) => onEndDateChange?.(event.target.value)}
              disabled={!isCustom}
              className={`${inputClass} disabled:bg-[#F8FAFC] disabled:text-slate-500`}
            />
          </Field>
        </div>

        {onSearchChange ? (
          <Field label="Busca" className={mobile ? "" : "lg:col-span-3"}>
            <input
              type="search"
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              className={inputClass}
              placeholder={searchPlaceholder}
            />
          </Field>
        ) : null}

        {onClientChange ? (
          <Field label="Cliente" className={mobile ? "" : "lg:col-span-2"}>
            <select value={clientValue} onChange={(event) => onClientChange(event.target.value)} className={inputClass}>
              <option value="">Todos</option>
              {clientOptions.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {onProductChange ? (
          <Field label="Produto" className={mobile ? "" : "lg:col-span-2"}>
            <select value={productValue} onChange={(event) => onProductChange(event.target.value)} className={inputClass}>
              <option value="">Todos</option>
              {productOptions.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {onCategoryChange ? (
          <Field label="Categoria" className={mobile ? "" : "lg:col-span-2"}>
            <select value={categoryValue} onChange={(event) => onCategoryChange(event.target.value)} className={inputClass}>
              <option value="">Todas</option>
              {categoryOptions.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {onStatusChange ? (
          <Field label="Status" className={mobile ? "" : "lg:col-span-2"}>
            <select value={statusValue} onChange={(event) => onStatusChange(event.target.value)} className={inputClass}>
              <option value="">Todos</option>
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {includeActions ? (
          <div className={mobile ? "grid gap-2 pt-1 sm:grid-cols-2" : "grid grid-cols-2 gap-2 lg:col-span-2 lg:self-end"}>
            <Button type="submit" size={mobile ? "lg" : "md"}>
              Aplicar
            </Button>
            <Button type="button" variant="secondary" size={mobile ? "lg" : "md"} onClick={handleClear}>
              Limpar
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="hidden rounded-[28px] border border-[#E2E8F0] bg-white p-4 shadow-soft sm:p-5 lg:block"
      >
        <div className="flex flex-col gap-2 border-b border-[#E2E8F0] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">{title}</p>
            {description ? <p className="mt-1 text-sm font-medium text-muted">{description}</p> : null}
          </div>
          {resultLabel ? (
            <span className="rounded-full bg-[#DBEAFE] px-3 py-1.5 text-xs font-black text-brand">
              {resultLabel}
            </span>
          ) : null}
        </div>

        {renderFields(false)}
      </form>

      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-3 shadow-soft lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">{title}</p>
            <p className="mt-1 truncate text-sm font-bold text-muted">
              {resultLabel || periodLabel({ period, startDate, endDate })}
            </p>
          </div>
          <Button type="button" size="sm" onClick={() => setMobileOpen(true)}>
            Filtros
          </Button>
        </div>
      </section>

      {mobileOpen ? createPortal(
        <div className="agensync-filter-overlay lg:hidden">
          <button
            type="button"
            className="agensync-filter-backdrop"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar filtros"
          />
          <form
            onSubmit={handleSubmit}
            className="agensync-filter-sheet"
          >
            <div className="agensync-filter-header">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">{title}</p>
                {description ? <p className="mt-1 text-sm font-medium leading-6 text-muted">{description}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] text-xl font-black text-ink active:scale-95"
                aria-label="Fechar filtros"
              >
                ×
              </button>
            </div>

            <div className="agensync-filter-body">
              {renderFields(true, false)}
            </div>

            <div className="agensync-filter-footer">
              <Button type="button" variant="secondary" size="lg" onClick={handleClear}>
                Limpar
              </Button>
              <Button type="submit" size="lg">
                Aplicar
              </Button>
            </div>
          </form>
        </div>,
        document.body
      ) : null}
    </>
  );
}
