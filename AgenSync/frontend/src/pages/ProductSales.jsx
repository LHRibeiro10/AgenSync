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
  listProductSales,
  listProducts,
  productSalesProfit,
  sumProductSales
} from "../services/products.js";
import { money } from "../utils.js";

const emptyForm = {
  productId: "",
  quantity: 1,
  date: rangeForPeriod("today").endDate,
  clientId: "",
  notes: ""
};

export default function ProductSales() {
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
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState("");
  const { showToast } = useToast();

  useEffect(() => {
    api
      .listClients()
      .then((data) => setClients(data.clients))
      .catch((err) => {
        setClients([]);
        setError(err.message);
      });
  }, []);

  const selectedProduct = products.find((product) => product.id === form.productId);
  const totalSales = sumProductSales(sales);
  const grossProfit = productSalesProfit(sales);
  const saleTotal = selectedProduct ? Number(selectedProduct.salePrice) * Number(form.quantity || 0) : 0;

  useEffect(() => {
    let active = true;
    Promise.all([listProducts({ activeOnly: true }), listProducts({ stock: "attention" })])
      .then(([activeProducts, stockAlerts]) => {
        if (!active) return;
        setProducts(activeProducts);
        setLowStockProducts(stockAlerts);
      })
      .catch((err) => {
        if (!active) return;
        setProducts([]);
        setLowStockProducts([]);
        showToast(err.message, "error");
      });

    return () => {
      active = false;
    };
  }, [version, showToast]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    listProductSales({
      startDate: filters.startDate,
      endDate: filters.endDate,
      productId: filters.productId,
      clientId: filters.clientId,
      search: filters.search
    })
      .then((filteredSales) => {
        if (!active) return;
        setSales(filteredSales);
      })
      .catch((err) => {
        if (!active) return;
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

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

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
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Vendas"
        description="Registre vendas avulsas de produtos e acompanhe o impacto no financeiro."
      />
      <Message type="error">{error}</Message>

      <section className="grid gap-5 xl:grid-cols-[390px_1fr]">
        <Card as="form" onSubmit={handleSubmit} className="space-y-4 p-5 xl:sticky xl:top-8 xl:self-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">Nova venda</p>
            <h2 className="mt-2 text-xl font-black tracking-tight text-ink">Vender produto</h2>
            <p className="mt-1 text-sm font-medium leading-6 text-muted">
              Ao salvar, o estoque baixa automaticamente.
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

          <Field label="Cliente opcional">
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

          <Button type="submit" className="w-full" size="lg">
            Registrar venda
          </Button>
        </Card>

        <div className="space-y-5">
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
            <CardHeader title="Vendas registradas" description={`${sales.length} venda(s) encontradas`} />
            <div className="compact-scroll-list divide-y divide-[#E2E8F0]">
              {loading ? (
                <Loading label="Carregando vendas..." />
              ) : sales.length ? (
                sales.map((sale) => (
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
                      <p className="text-lg font-black text-success">{money(sale.total)}</p>
                      <p className="text-xs font-bold text-muted">unitário {money(sale.unitPrice)}</p>
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
    </div>
  );
}
