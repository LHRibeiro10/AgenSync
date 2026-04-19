import { useEffect, useState } from "react";
import Button from "../components/Button.jsx";
import Card, { CardHeader } from "../components/Card.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Field, { inputClass } from "../components/Field.jsx";
import FilterBar, { periodLabel, rangeForPeriod } from "../components/FilterBar.jsx";
import Loading from "../components/Loading.jsx";
import Message from "../components/Message.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useToast } from "../components/Toast.jsx";
import {
  createExpense,
  deleteExpense,
  expenseCategories,
  expenseCategoryLabel,
  listExpenses,
  sumExpenses,
  updateExpense
} from "../services/expenses.js";
import { money } from "../utils.js";

const emptyForm = {
  description: "",
  category: "materiais",
  amount: "",
  date: rangeForPeriod("today").endDate,
  recurrence: "once",
  notes: ""
};

export default function Expenses() {
  const initialRange = rangeForPeriod("thisMonth");
  const [filters, setFilters] = useState({
    period: "thisMonth",
    startDate: initialRange.startDate,
    endDate: initialRange.endDate,
    category: "",
    search: ""
  });
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");
  const { showToast } = useToast();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    listExpenses({
        startDate: filters.startDate,
        endDate: filters.endDate,
        category: filters.category,
        search: filters.search
      })
      .then((data) => {
        if (active) setExpenses(data);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message);
        showToast(err.message, "error");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filters, refreshKey, showToast]);

  const totalExpenses = sumExpenses(expenses);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function resetFilters() {
    const range = rangeForPeriod("thisMonth");
    setFilters({
      period: "thisMonth",
      startDate: range.startDate,
      endDate: range.endDate,
      category: "",
      search: ""
    });
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setEditing(null);
    setForm(emptyForm);
  }

  function startEdit(expense) {
    setEditing(expense.sourceId || expense.id);
    setForm({
      description: expense.description,
      category: expense.category,
      amount: expense.amount,
      date: expense.originalDate || expense.date,
      recurrence: expense.recurrence || "once",
      notes: expense.notes || ""
    });
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    try {
      if (editing) {
        await updateExpense(editing, form);
        showToast("Despesa atualizada.");
      } else {
        await createExpense(form);
        showToast("Despesa registrada.");
      }
      setRefreshKey((current) => current + 1);
      resetForm();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const sourceId = pendingDelete.sourceId || pendingDelete.id;
    try {
      await deleteExpense(sourceId);
      if (editing === sourceId) resetForm();
      setRefreshKey((current) => current + 1);
      showToast("Despesa excluída.");
      setPendingDelete(null);
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Despesas"
        description="Registre custos, acompanhe saídas e entenda quanto realmente sobra no caixa."
      />
      <Message type="error">{error}</Message>

      <section className="grid min-w-0 max-w-full gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
        <Card as="form" onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-5 xl:sticky xl:top-8 xl:self-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">
              {editing ? "Editar saída" : "Nova saída"}
            </p>
            <h2 className="mt-2 text-xl font-black tracking-tight text-ink">
              {editing ? "Atualizar despesa" : "Registrar despesa"}
            </h2>
            <p className="mt-1 text-sm font-medium leading-6 text-muted">
              Lance materiais, contas, marketing e outros custos para calcular o líquido real.
            </p>
          </div>

          <Field label="Descrição">
            <input
              required
              minLength={2}
              value={form.description}
              onChange={(event) => updateForm("description", event.target.value)}
              className={inputClass}
              placeholder="Ex: Compra de produtos"
            />
          </Field>

          <Field label="Tipo de despesa">
            <select
              required
              value={form.recurrence}
              onChange={(event) => updateForm("recurrence", event.target.value)}
              className={inputClass}
            >
              <option value="once">Despesa única</option>
              <option value="monthly">Despesa fixa mensal</option>
            </select>
          </Field>

          {form.recurrence === "monthly" ? (
            <p className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-bold leading-6 text-blue-900">
              A despesa fixa entra no mês da data escolhida e se repete automaticamente nos próximos meses.
            </p>
          ) : null}

          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Field label="Categoria">
              <select
                required
                value={form.category}
                onChange={(event) => updateForm("category", event.target.value)}
                className={inputClass}
              >
                {expenseCategories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={form.recurrence === "monthly" ? "Começa em" : "Data"}>
              <input
                required
                type="date"
                value={form.date}
                onChange={(event) => updateForm("date", event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Valor">
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(event) => updateForm("amount", event.target.value)}
              className={inputClass}
              placeholder="0,00"
            />
          </Field>

          <Field label="Observações">
            <textarea
              value={form.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
              className={`${inputClass} min-h-24 resize-none`}
              placeholder="Detalhes opcionais"
            />
          </Field>

          <div className="grid min-w-0 grid-cols-2 gap-2">
            {editing ? (
              <Button variant="secondary" onClick={resetForm}>
                Cancelar
              </Button>
            ) : null}
            <Button type="submit" className={editing ? "" : "col-span-2"}>
              {editing ? "Atualizar" : form.recurrence === "monthly" ? "Salvar despesa fixa" : "Salvar despesa"}
            </Button>
          </div>
        </Card>

        <div className="min-w-0 max-w-full space-y-5">
          <FilterBar
            title="Filtrar despesas"
            description="Veja custos por período, categoria ou descrição."
            period={filters.period}
            startDate={filters.startDate}
            endDate={filters.endDate}
            onPeriodChange={(value) => updateFilter("period", value)}
            onStartDateChange={(value) => updateFilter("startDate", value)}
            onEndDateChange={(value) => updateFilter("endDate", value)}
            searchValue={filters.search}
            onSearchChange={(value) => updateFilter("search", value)}
            searchPlaceholder="Buscar descrição, categoria ou observação"
            categoryValue={filters.category}
            onCategoryChange={(value) => updateFilter("category", value)}
            categoryOptions={expenseCategories}
            onSubmit={() => null}
            onClear={resetFilters}
            resultLabel={periodLabel(filters)}
          />

          <section className="grid min-w-0 max-w-full gap-4 sm:grid-cols-3">
            <article className="min-w-0 max-w-full rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-soft sm:p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Despesas</p>
              <p className="mt-2 text-3xl font-black text-red-600">{money(totalExpenses)}</p>
            </article>
            <article className="min-w-0 max-w-full rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-soft sm:p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Registros</p>
              <p className="mt-2 text-3xl font-black text-ink">{expenses.length}</p>
            </article>
            <article className="min-w-0 max-w-full rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-soft sm:p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Ticket médio</p>
              <p className="mt-2 text-3xl font-black text-ink">
                {money(expenses.length ? totalExpenses / expenses.length : 0)}
              </p>
            </article>
          </section>

          <Card className="overflow-hidden">
            <CardHeader title="Despesas registradas" description={`${expenses.length} saída(s) encontradas`} />
            <div className="compact-scroll-list divide-y divide-[#E2E8F0]">
              {loading ? (
                <Loading label="Carregando despesas..." />
              ) : expenses.length ? (
                expenses.map((expense) => (
                  <article
                    key={expense.id}
                    className="grid gap-3 p-4 transition duration-200 hover:bg-[#F8FAFC] active:bg-red-50/50 lg:grid-cols-[1fr_auto] lg:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-black text-ink">{expense.description}</p>
                        <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-black text-red-700 ring-1 ring-red-100">
                          {expenseCategoryLabel(expense.category)}
                        </span>
                        {expense.recurrence === "monthly" ? (
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-brand ring-1 ring-blue-100">
                            Fixa mensal
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm font-medium text-muted">
                        {expense.recurrence === "monthly"
                          ? `Competência ${expense.date}${expense.originalDate ? ` · desde ${expense.originalDate}` : ""}`
                          : expense.date}
                      </p>
                      {expense.notes ? <p className="mt-2 text-sm text-muted">{expense.notes}</p> : null}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[auto_auto_auto] sm:items-center">
                      <p className="text-lg font-black text-red-600 sm:text-right">{money(expense.amount)}</p>
                      <Button variant="secondary" onClick={() => startEdit(expense)}>
                        Editar
                      </Button>
                      <Button variant="danger" onClick={() => setPendingDelete(expense)}>
                        Excluir
                      </Button>
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState title="Nenhuma despesa encontrada" description="Ajuste os filtros ou registre uma nova saída." />
              )}
            </div>
          </Card>
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Excluir despesa?"
        description={
          pendingDelete
            ? pendingDelete.recurrence === "monthly"
              ? `${pendingDelete.description} será removida do mês atual e dos próximos meses.`
              : `${pendingDelete.description} será removida do controle financeiro.`
            : ""
        }
        confirmLabel="Excluir"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
