import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import Button from "../components/Button.jsx";
import Card, { CardHeader } from "../components/Card.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Field, { inputClass } from "../components/Field.jsx";
import FilterBar, { periodLabel, rangeForPeriod } from "../components/FilterBar.jsx";
import Loading from "../components/Loading.jsx";
import Message from "../components/Message.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useToast } from "../components/Toast.jsx";
import {
  createProductSale,
  getSalesOverview,
  productSalesProfit,
  stockStatus,
  sumProductSales
} from "../services/products.js";
import { exportSimpleTableExcel } from "../services/excelReport.js";
import { money } from "../utils.js";

const emptyForm = {
  productId: "",
  quantity: 1,
  date: rangeForPeriod("today").endDate,
  clientId: "",
  notes: ""
};

const salesViews = {
  new: {
    title: "Nova venda",
    description: "Venda produtos com baixa automatica de estoque.",
    eyebrow: "Venda rapida",
    panelTitle: "Vender produto",
    panelDescription: "Ao salvar, o estoque baixa automaticamente.",
    listTitle: "Vendas recentes",
    showForm: true
  },
  history: {
    title: "Historico de vendas",
    description: "Consulte vendas por periodo, produto, cliente e busca livre.",
    eyebrow: "Consulta",
    panelTitle: "Filtros avancados",
    panelDescription: "Use periodo, produto, cliente e busca para localizar vendas.",
    listTitle: "Historico filtrado",
    showForm: false
  },
  reports: {
    title: "Relatorios de vendas",
    description: "Acompanhe total vendido, margem estimada, ticket medio e alertas de estoque.",
    eyebrow: "Analise",
    panelTitle: "Indicadores",
    panelDescription: "Resumo operacional das vendas de produtos.",
    listTitle: "Base do relatorio",
    showForm: false
  },
  commissions: {
    title: "Comissoes",
    description: "Calcule comissoes sobre as vendas filtradas por periodo, produto e cliente.",
    eyebrow: "Comissoes",
    panelTitle: "Calculo de comissao",
    panelDescription: "Defina percentual, base e responsavel pelo pagamento.",
    listTitle: "Vendas com comissao",
    showForm: false
  }
};

function QuickCreateModal({ open, title, description, children, saving, onSubmit, onClose }) {
  if (!open) return null;

  return (
    <div className="agensync-overlay z-50 flex items-end bg-slate-950/45 p-3 sm:items-center sm:justify-center">
      <form onSubmit={onSubmit} className="w-full rounded-xl border border-line bg-white p-5 shadow-panel sm:max-w-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-ink">{title}</h2>
            {description ? <p className="mt-1 text-sm leading-6 text-muted">{description}</p> : null}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar">
            Fechar
          </Button>
        </div>
        <div className="mt-5 space-y-4">{children}</div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Cadastrar
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function ProductSales({ mode = "new" }) {
  const view = salesViews[mode] || salesViews.new;
  const initialRange = rangeForPeriod("thisMonth");
  const [filters, setFilters] = useState({
    period: "thisMonth",
    startDate: initialRange.startDate,
    endDate: initialRange.endDate,
    productId: "",
    clientId: "",
    search: ""
  });
  const [form, setForm] = useState(emptyForm);
  const [clients, setClients] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [commission, setCommission] = useState({ professionalId: "", rate: 10, base: "sales" });
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [quickClientForm, setQuickClientForm] = useState({ name: "", phone: "", notes: "" });
  const [quickSaving, setQuickSaving] = useState(false);
  const [saleSaving, setSaleSaving] = useState(false);
  const [error, setError] = useState("");
  const { showToast } = useToast();

  const selectedProduct = products.find((product) => product.id === form.productId);
  const selectedCommissionProfessional = professionals.find((professional) => professional.id === commission.professionalId);
  const totalSales = sumProductSales(sales);
  const grossProfit = productSalesProfit(sales);
  const saleTotal = selectedProduct ? Number(selectedProduct.salePrice) * Number(form.quantity || 0) : 0;
  const commissionRate = Math.max(0, Number(commission.rate || 0));
  const commissionBaseTotal = commission.base === "profit" ? grossProfit : totalSales;
  const commissionTotal = (commissionBaseTotal * commissionRate) / 100;
  const commissionRows = sales.map((sale) => {
    const base =
      commission.base === "profit"
        ? (Number(sale.unitPrice || 0) - Number(sale.unitCost || 0)) * Number(sale.quantity || 0)
        : Number(sale.total || 0);

    return {
      ...sale,
      commissionBase: base,
      commissionAmount: (base * commissionRate) / 100
    };
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    getSalesOverview({
      startDate: filters.startDate,
      endDate: filters.endDate,
      productId: filters.productId,
      clientId: filters.clientId,
      search: filters.search
    })
      .then((overview) => {
        if (!active) return;
        const activeProducts = overview?.products || [];
        setClients(overview?.clients || []);
        setProfessionals(overview?.professionals || []);
        setProducts(activeProducts);
        setLowStockProducts(activeProducts.filter((product) => ["low", "out"].includes(stockStatus(product))));
        setSales(overview?.sales || []);
      })
      .catch((err) => {
        if (!active) return;
        setClients([]);
        setProfessionals([]);
        setProducts([]);
        setLowStockProducts([]);
        setSales([]);
        setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filters, version]);

  useEffect(() => {
    if (!error) return;
    showToast(error, "error");
  }, [error, showToast]);

  function refresh() {
    setVersion((current) => current + 1);
  }

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function resetFilters() {
    const range = rangeForPeriod("thisMonth");
    setFilters({
      period: "thisMonth",
      startDate: range.startDate,
      endDate: range.endDate,
      productId: "",
      clientId: "",
      search: ""
    });
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateCommission(field, value) {
    setCommission((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saleSaving) return;
    setError("");
    setSaleSaving(true);

    const client = clients.find((item) => item.id === form.clientId);

    try {
      await createProductSale({
        ...form,
        quantity: Number(form.quantity),
        clientName: client?.name || ""
      });
      showToast("Venda registrada e estoque atualizado.");
      setForm(emptyForm);
      refresh();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setSaleSaving(false);
    }
  }

  async function createQuickClient(event) {
    event.preventDefault();
    setQuickSaving(true);
    setError("");

    try {
      const result = await api.createClient(quickClientForm);
      setClients((current) => [...current, result.client].sort((first, second) => first.name.localeCompare(second.name)));
      updateForm("clientId", result.client.id);
      setQuickClientForm({ name: "", phone: "", notes: "" });
      setQuickClientOpen(false);
      showToast("Cliente cadastrado e selecionado.");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setQuickSaving(false);
    }
  }

  function exportExcel() {
    exportSimpleTableExcel({
      title: "Histórico de vendas",
      subtitle: periodLabel(filters),
      headers: ["Data", "Produto", "Quantidade", "Valor total", "Cliente", "Observações"],
      rows: sales.map((sale) => [
        { value: sale.date, style: 5 },
        { value: sale.productName, style: 5 },
        { value: Number(sale.quantity || 0), style: 5 },
        { value: Number(sale.total || 0), style: 7 },
        { value: sale.clientName || "Venda avulsa", style: 5 },
        { value: sale.notes || "", style: 5 }
      ]),
      emptyLabel: "Nenhuma venda no período.",
      filenamePrefix: "agensync-vendas",
      filenameSuffix: `${filters.startDate || "inicio"}-${filters.endDate || "fim"}`
    });
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title={view.title}
        description={view.description}
        action={
          mode === "history" ? (
            <Button variant="secondary" onClick={exportExcel} disabled={!sales.length}>
              Exportar Excel
            </Button>
          ) : undefined
        }
      />
      <Message type="error">{error}</Message>

      <section className={`grid gap-5 ${view.showForm ? "xl:grid-cols-[390px_1fr]" : ""}`}>
        {view.showForm ? (
        <Card as="form" onSubmit={handleSubmit} className="space-y-4 p-5 xl:sticky xl:top-8 xl:self-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">{view.eyebrow}</p>
            <h2 className="mt-2 text-xl font-black tracking-tight text-ink">{view.panelTitle}</h2>
            <p className="mt-1 text-sm font-medium leading-6 text-muted">
              {view.panelDescription}
            </p>
          </div>

          <Field label="Produto">
            <select
              required
              value={form.productId}
              onChange={(event) => updateForm("productId", event.target.value)}
              className={inputClass}
            >
              <option value="">Selecione</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} · estoque {product.stockQty}
                </option>
              ))}
            </select>
          </Field>

          {selectedProduct ? (
            <div className="rounded-2xl border border-[#DBEAFE] bg-[#EFF6FF] p-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-brand/70">Preço</p>
                  <p className="text-sm font-black text-brand">{money(selectedProduct.salePrice)}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-brand/70">Estoque</p>
                  <p className="text-sm font-black text-brand">{selectedProduct.stockQty}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-brand/70">Total</p>
                  <p className="text-sm font-black text-brand">{money(saleTotal)}</p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Quantidade">
              <input
                required
                type="number"
                min="1"
                value={form.quantity}
                onChange={(event) => updateForm("quantity", Number(event.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label="Data">
              <input
                required
                type="date"
                value={form.date}
                onChange={(event) => updateForm("date", event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <Field
            label={
              <span className="flex items-center justify-between gap-3">
                <span>Cliente opcional</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2 text-[13px] font-black text-muted hover:text-brand"
                  onClick={() => setQuickClientOpen(true)}
                >
                  + Novo cliente
                </Button>
              </span>
            }
          >
            <select value={form.clientId} onChange={(event) => updateForm("clientId", event.target.value)} className={inputClass}>
              <option value="">Venda avulsa</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Observações">
            <textarea
              value={form.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
              className={`${inputClass} min-h-24 resize-none`}
              placeholder="Detalhes opcionais"
            />
          </Field>

          <Button type="submit" className="w-full" size="lg" loading={saleSaving} loadingLabel="Registrando...">
            Registrar venda
          </Button>
        </Card>
        ) : null}

        <div className="space-y-5">
          {!view.showForm ? (
            <Card className="p-4 sm:p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">{view.eyebrow}</p>
              <p className="mt-2 text-sm font-bold leading-6 text-muted">{view.panelDescription}</p>
            </Card>
          ) : null}

          <section className="grid gap-4 sm:grid-cols-3">
            <article className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-soft">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Vendas</p>
              <p className="mt-2 text-3xl font-black text-success">{money(totalSales)}</p>
            </article>
            <article className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-soft">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Margem estimada</p>
              <p className="mt-2 text-3xl font-black text-brand">{money(grossProfit)}</p>
            </article>
            <article className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-soft">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Atenção estoque</p>
              <p className="mt-2 text-3xl font-black text-amber-700">{lowStockProducts.length}</p>
            </article>
          </section>

          {mode === "commissions" ? (
            <Card className="p-4 sm:p-5">
              <div className="grid gap-4 lg:grid-cols-[1fr_150px_180px] lg:items-end">
                <Field label="Profissional a pagar">
                  <select
                    value={commission.professionalId}
                    onChange={(event) => updateCommission("professionalId", event.target.value)}
                    className={inputClass}
                  >
                    <option value="">Equipe geral</option>
                    {professionals.map((professional) => (
                      <option key={professional.id} value={professional.id}>
                        {professional.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Percentual">
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={commission.rate}
                      onChange={(event) => updateCommission("rate", event.target.value)}
                      className={`${inputClass} pr-10`}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-black text-muted">
                      %
                    </span>
                  </div>
                </Field>
                <Field label="Base">
                  <select
                    value={commission.base}
                    onChange={(event) => updateCommission("base", event.target.value)}
                    className={inputClass}
                  >
                    <option value="sales">Valor vendido</option>
                    <option value="profit">Margem estimada</option>
                  </select>
                </Field>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Base filtrada</p>
                  <p className="mt-2 text-xl font-black text-ink">{money(commissionBaseTotal)}</p>
                </div>
                <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Percentual</p>
                  <p className="mt-2 text-xl font-black text-ink">{commissionRate.toLocaleString("pt-BR")}%</p>
                </div>
                <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-success">A pagar</p>
                  <p className="mt-2 text-xl font-black text-success">{money(commissionTotal)}</p>
                </div>
              </div>

              <p className="mt-3 text-sm font-bold text-muted">
                {selectedCommissionProfessional?.name || "Equipe geral"} · {sales.length} venda(s) no filtro atual
              </p>
            </Card>
          ) : null}

          <FilterBar
            title="Filtrar vendas"
            description="Localize vendas por período, produto, cliente ou busca livre."
            period={filters.period}
            startDate={filters.startDate}
            endDate={filters.endDate}
            onPeriodChange={(value) => updateFilter("period", value)}
            onStartDateChange={(value) => updateFilter("startDate", value)}
            onEndDateChange={(value) => updateFilter("endDate", value)}
            searchValue={filters.search}
            onSearchChange={(value) => updateFilter("search", value)}
            searchPlaceholder="Buscar produto, cliente ou observação"
            productValue={filters.productId}
            onProductChange={(value) => updateFilter("productId", value)}
            productOptions={products}
            clientValue={filters.clientId}
            onClientChange={(value) => updateFilter("clientId", value)}
            clientOptions={clients}
            onSubmit={() => null}
            onClear={resetFilters}
            resultLabel={periodLabel(filters)}
          />

          <Card className="overflow-hidden">
            <CardHeader title={view.listTitle} description={`${sales.length} venda(s) encontradas`} />
            <div className="compact-scroll-list divide-y divide-[#E2E8F0]">
              {loading ? (
                <Loading label="Carregando vendas..." />
              ) : sales.length ? (
                (mode === "commissions" ? commissionRows : sales).map((sale) => (
                  <article
                    key={sale.id}
                    className="grid gap-3 p-4 transition duration-200 hover:bg-[#F8FAFC] lg:grid-cols-[1fr_auto] lg:items-center"
                  >
                    <div className="min-w-0">
                      <p className="text-base font-black text-ink">{sale.productName}</p>
                      <p className="mt-1 text-sm font-medium text-muted">
                        {sale.quantity} unidade(s) · {sale.clientName || "Venda avulsa"} · {sale.date}
                      </p>
                      {sale.notes ? <p className="mt-2 text-sm text-muted">{sale.notes}</p> : null}
                    </div>
                    <div className="text-right">
                      {mode === "commissions" ? (
                        <>
                          <p className="text-lg font-black text-success">{money(sale.commissionAmount)}</p>
                          <p className="text-xs font-bold text-muted">base {money(sale.commissionBase)}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-lg font-black text-success">{money(sale.total)}</p>
                          <p className="text-xs font-bold text-muted">unitário {money(sale.unitPrice)}</p>
                        </>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState title="Nenhuma venda encontrada" description="Registre uma venda ou ajuste os filtros." />
              )}
            </div>
          </Card>
        </div>
      </section>

      <QuickCreateModal
        open={quickClientOpen}
        title="Novo cliente"
        description="Cadastre sem sair da venda."
        saving={quickSaving}
        onSubmit={createQuickClient}
        onClose={() => setQuickClientOpen(false)}
      >
        <Field label="Nome">
          <input
            required
            minLength={2}
            value={quickClientForm.name}
            onChange={(event) => setQuickClientForm((current) => ({ ...current, name: event.target.value }))}
            className={inputClass}
            placeholder="Nome do cliente"
          />
        </Field>
        <Field label="Telefone (opcional)">
          <input
            value={quickClientForm.phone}
            onChange={(event) => setQuickClientForm((current) => ({ ...current, phone: event.target.value }))}
            className={inputClass}
            placeholder="(00) 00000-0000"
          />
        </Field>
        <Field label="Observacoes">
          <textarea
            value={quickClientForm.notes}
            onChange={(event) => setQuickClientForm((current) => ({ ...current, notes: event.target.value }))}
            className={`${inputClass} min-h-24 resize-none`}
            placeholder="Preferencias ou detalhes importantes"
          />
        </Field>
      </QuickCreateModal>
    </div>
  );
}
