import { useEffect, useState } from "react";
import { useSubmitLock } from "../hooks/useSubmitLock.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { getSuggestedProductNames } from "../data/businessOnboarding.js";
import Button from "../components/Button.jsx";
import Card, { CardHeader } from "../components/Card.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Field, { inputClass } from "../components/Field.jsx";
import Loading from "../components/Loading.jsx";
import Message from "../components/Message.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useToast } from "../components/Toast.jsx";
import {
  addProductStockMovement,
  createProduct,
  createProductVariant,
  deleteProduct,
  deleteProductVariant,
  listProducts,
  listProductStockMovements,
  listProductVariants,
  productCategories,
  productCategoryLabel,
  stockStatus,
  toggleProduct,
  updateProduct
} from "../services/products.js";
import { money } from "../utils.js";

const emptyForm = {
  name: "",
  category: "cosmeticos",
  costPrice: "",
  salePrice: "",
  stockQty: 0,
  minStock: 2,
  description: "",
  isActive: true,
  brand: "",
  supplierName: "",
  supplierContact: "",
  sku: "",
  unit: "unidade",
  expirationDate: "",
  usageType: "revenda"
};

const unitOptions = [
  { value: "unidade", label: "Unidade" },
  { value: "ml", label: "ml" },
  { value: "g", label: "g" },
  { value: "kg", label: "kg" }
];

const usageTypeOptions = [
  { value: "revenda", label: "Revenda" },
  { value: "uso_interno", label: "Uso interno" },
  { value: "ambos", label: "Uso interno e revenda" }
];

function isNearExpiration(expirationDate) {
  if (!expirationDate) return false;
  const diffDays = (new Date(expirationDate) - new Date()) / (1000 * 60 * 60 * 24);
  return diffDays <= 30;
}

const stockFilters = [
  { value: "", label: "Todos" },
  { value: "attention", label: "Estoque baixo/zerado" },
  { value: "low", label: "Estoque baixo" },
  { value: "out", label: "Sem estoque" }
];

const productViews = {
  catalog: {
    title: "Produtos",
    description: "Cadastro, categorias, estoque, reposicao e status de venda em uma unica tela.",
    eyebrow: "Cadastro e estoque",
    formTitle: "Cadastrar produto",
    formDescription: "Informe preco, categoria, estoque atual e estoque minimo.",
    listTitle: "Produtos cadastrados",
    highlight: "Cadastre produtos, ajuste estoque, acompanhe margens e resolva alertas sem sair desta tela."
  },
  stock: {
    title: "Estoque",
    description: "Controle quantidades, alertas e entrada rapida de estoque.",
    eyebrow: "Operacao de estoque",
    formTitle: "Produto com estoque",
    formDescription: "Use os filtros e o botao de entrada para atualizar quantidades.",
    listTitle: "Itens em estoque",
    highlight: "Visao operacional para estoque baixo, sem estoque e reposicao."
  }
};

function StockBadge({ product }) {
  const status = stockStatus(product);
  const classes = {
    ok: "bg-[#D1FAE5] text-success ring-green-200",
    low: "bg-amber-100 text-amber-800 ring-amber-200",
    out: "bg-red-100 text-red-700 ring-red-200"
  };
  const labels = {
    ok: "Estoque ok",
    low: "Estoque baixo",
    out: "Sem estoque"
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ring-1 ${classes[status]}`}>
      {labels[status]}
    </span>
  );
}

function ProductStatusBadge({ active }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-black ring-1 ${
        active ? "bg-[#D1FAE5] text-success ring-green-200" : "bg-zinc-100 text-zinc-600 ring-zinc-200"
      }`}
    >
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

function AddStockModal({ product, amount, error, onAmountChange, onConfirm, onClose }) {
  if (!product) return null;

  return (
    <div className="agensync-overlay z-50 flex items-end bg-slate-950/45 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Fechar adicionar estoque" />

      <section className="relative w-full rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-panel sm:max-w-md">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">Entrada de estoque</p>
          <h2 className="mt-2 text-xl font-black text-ink">Adicionar estoque</h2>
          <p className="mt-2 text-sm font-bold leading-6 text-muted">{product.name}</p>
        </div>

        <div className="mt-4 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Estoque atual</p>
          <p className="mt-1 text-2xl font-black text-ink">{product.stockQty}</p>
        </div>

        <div className="mt-4">
          <Field label="Quantidade a adicionar">
            <input
              autoFocus
              required
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(event) => onAmountChange(event.target.value)}
              className={inputClass}
              placeholder="Ex: 10"
            />
          </Field>
        </div>

        <Message type="error">{error}</Message>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onConfirm}>Confirmar</Button>
        </div>
      </section>
    </div>
  );
}

function formatMovementDate(value) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function ProductDetailsPanel({ product, showToast }) {
  const [tab, setTab] = useState("history");
  const [movements, setMovements] = useState([]);
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [variantForm, setVariantForm] = useState({ label: "", costPrice: "", salePrice: "", stockQty: "" });

  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.all([listProductStockMovements(product.id), listProductVariants(product.id)])
      .then(([movementsResult, variantsResult]) => {
        if (!active) return;
        setMovements(movementsResult?.movements || []);
        setVariants(variantsResult || []);
      })
      .catch((err) => showToast(err.message, "error"))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [product.id, showToast]);

  async function submitVariant(event) {
    event.preventDefault();
    try {
      const created = await createProductVariant(product.id, variantForm);
      setVariants((current) => [...current, created]);
      setVariantForm({ label: "", costPrice: "", salePrice: "", stockQty: "" });
      showToast("Variação adicionada.");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function removeVariant(variantId) {
    try {
      await deleteProductVariant(product.id, variantId);
      setVariants((current) => current.filter((variant) => variant.id !== variantId));
      showToast("Variação removida.");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  return (
    <div className="col-span-full rounded-2xl border border-line bg-slate-50 p-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("history")}
          className={`rounded-lg px-3 py-2 text-xs font-black ${tab === "history" ? "bg-brand text-white" : "bg-white text-muted"}`}
        >
          Histórico de estoque
        </button>
        <button
          type="button"
          onClick={() => setTab("variants")}
          className={`rounded-lg px-3 py-2 text-xs font-black ${tab === "variants" ? "bg-brand text-white" : "bg-white text-muted"}`}
        >
          Variações
        </button>
      </div>

      {loading ? (
        <div className="mt-3">
          <Loading label="Carregando..." />
        </div>
      ) : tab === "history" ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-black uppercase text-muted">Saldo atual: {product.stockQty}</p>
          {movements.length ? (
            movements.map((movement) => (
              <div key={movement.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                <span className="font-bold text-ink">
                  {movement.type === "entrada" ? "Entrada" : "Saída"} de {movement.quantity}
                  {movement.supplierName ? ` · ${movement.supplierName}` : ""}
                </span>
                <span className="text-xs font-bold text-muted">{formatMovementDate(movement.createdAt)}</span>
              </div>
            ))
          ) : (
            <p className="text-sm font-semibold text-muted">Nenhuma movimentação registrada.</p>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {variants.map((variant) => (
            <div key={variant.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
              <span className="font-bold text-ink">
                {variant.label} · {money(variant.salePrice)} · estoque {variant.stockQty}
              </span>
              <button type="button" onClick={() => removeVariant(variant.id)} className="text-xs font-black text-danger">
                Remover
              </button>
            </div>
          ))}

          <form onSubmit={submitVariant} className="grid gap-2 sm:grid-cols-4">
            <input
              required
              placeholder="Ex: 300ml"
              value={variantForm.label}
              onChange={(event) => setVariantForm((current) => ({ ...current, label: event.target.value }))}
              className={inputClass}
            />
            <input
              required
              type="number"
              min="0"
              step="0.01"
              placeholder="Custo"
              value={variantForm.costPrice}
              onChange={(event) => setVariantForm((current) => ({ ...current, costPrice: event.target.value }))}
              className={inputClass}
            />
            <input
              required
              type="number"
              min="0"
              step="0.01"
              placeholder="Venda"
              value={variantForm.salePrice}
              onChange={(event) => setVariantForm((current) => ({ ...current, salePrice: event.target.value }))}
              className={inputClass}
            />
            <div className="flex gap-2">
              <input
                required
                type="number"
                min="0"
                placeholder="Estoque"
                value={variantForm.stockQty}
                onChange={(event) => setVariantForm((current) => ({ ...current, stockQty: event.target.value }))}
                className={inputClass}
              />
              <Button type="submit" size="sm">
                Adicionar
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function Products({ mode = "catalog" }) {
  const view = productViews[mode] || productViews.catalog;
  const [filters, setFilters] = useState({ search: "", category: "", stock: mode === "stock" ? "attention" : "" });
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [stockTarget, setStockTarget] = useState(null);
  const [stockAmount, setStockAmount] = useState("");
  const [stockError, setStockError] = useState("");
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [saving, guardSubmit] = useSubmitLock();
  const [expandedProductId, setExpandedProductId] = useState("");
  const { showToast } = useToast();
  const { user } = useAuth();

  const costPriceNumber = Number(form.costPrice);
  const salePriceNumber = Number(form.salePrice);
  const hasMarginInputs = form.costPrice !== "" && form.salePrice !== "" && salePriceNumber > 0;
  const profitPerUnit = hasMarginInputs ? salePriceNumber - costPriceNumber : 0;
  const marginPercent = hasMarginInputs ? (profitPerUnit / salePriceNumber) * 100 : 0;

  const lowStock = allProducts.filter((product) => stockStatus(product) === "low").length;
  const outStock = allProducts.filter((product) => stockStatus(product) === "out").length;
  const attentionProducts = allProducts.filter((product) => ["low", "out"].includes(stockStatus(product)));
  const categoryCounts = productCategories
    .map((category) => ({
      ...category,
      count: allProducts.filter((product) => product.category === category.value).length
    }))
    .filter((category) => category.count > 0);

  useEffect(() => {
    setFilters((current) => ({ ...current, stock: mode === "stock" ? "attention" : "" }));
  }, [mode]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const hasActiveFilters = Object.values(filters).some(Boolean);

    Promise.all([listProducts(filters), hasActiveFilters ? listProducts() : Promise.resolve(null)])
      .then(([filteredProducts, everyProduct]) => {
        if (!active) return;
        setProducts(filteredProducts);
        setAllProducts(everyProduct || filteredProducts);
      })
      .catch((err) => {
        if (!active) return;
        setProducts([]);
        setAllProducts([]);
        setError(err.message);
        showToast(err.message, "error");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filters, version, showToast]);

  function refresh() {
    setVersion((current) => current + 1);
  }

  useEffect(() => {
    function handleNewProductRequest() {
      setEditing(null);
      setForm(emptyForm);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    window.addEventListener("agensync:new-product", handleNewProductRequest);
    return () => window.removeEventListener("agensync:new-product", handleNewProductRequest);
  }, []);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  function resetFilters() {
    setFilters({ search: "", category: "", stock: "" });
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setEditing(null);
    setForm(emptyForm);
  }

  function startEdit(product) {
    setEditing(product.id);
    setForm({
      name: product.name,
      category: product.category,
      costPrice: product.costPrice,
      salePrice: product.salePrice,
      stockQty: product.stockQty,
      minStock: product.minStock,
      description: product.description || "",
      isActive: product.isActive,
      brand: product.brand || "",
      supplierName: product.supplierName || "",
      supplierContact: product.supplierContact || "",
      sku: product.sku || "",
      unit: product.unit || "unidade",
      expirationDate: product.expirationDate || "",
      usageType: product.usageType || "revenda"
    });
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    await guardSubmit(async () => {
      try {
        if (editing) {
          await updateProduct(editing, form);
          showToast("Produto atualizado.");
        } else {
          await createProduct(form);
          showToast("Produto cadastrado.");
        }
        resetForm();
        refresh();
      } catch (err) {
        setError(err.message);
        showToast(err.message, "error");
      }
    });
  }

  async function handleToggle(product) {
    try {
      await toggleProduct(product.id, product);
      showToast(product.isActive ? "Produto inativado." : "Produto ativado.");
      refresh();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  function openStockModal(product) {
    setStockTarget(product);
    setStockAmount("");
    setStockError("");
  }

  function closeStockModal() {
    setStockTarget(null);
    setStockAmount("");
    setStockError("");
  }

  async function confirmAddStock() {
    if (!stockTarget) return;

    const amount = Number(stockAmount);
    if (!Number.isInteger(amount) || amount <= 0) {
      setStockError("Informe uma quantidade inteira maior que zero.");
      return;
    }

    try {
      await addProductStockMovement(stockTarget.id, { type: "entrada", quantity: amount });
      showToast("Estoque atualizado.");
      closeStockModal();
      refresh();
    } catch (err) {
      setStockError(err.message);
      showToast(err.message, "error");
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteProduct(pendingDelete.id);
      showToast("Produto excluído.");
      setPendingDelete(null);
      refresh();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title={view.title} description={view.description} />
      <Message type="error" actionLabel="Tentar novamente" onAction={refresh}>
        {error}
      </Message>

      <Card className="p-4 sm:p-5">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">{view.eyebrow}</p>
        <p className="mt-2 text-sm font-bold leading-6 text-muted">{view.highlight}</p>
      </Card>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-soft">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Produtos cadastrados</p>
          <p className="mt-2 text-3xl font-black text-ink">{allProducts.length}</p>
        </article>
        <article className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-soft">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Estoque baixo</p>
          <p className="mt-2 text-3xl font-black text-amber-700">{lowStock}</p>
        </article>
        <article className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-soft">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-muted">Sem estoque</p>
          <p className="mt-2 text-3xl font-black text-red-600">{outStock}</p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">Reposição</p>
              <h2 className="mt-2 text-lg font-black text-ink">Alertas de estoque</h2>
            </div>
            <Button variant="secondary" size="sm" onClick={() => updateFilter("stock", "attention")}>
              Ver alertas
            </Button>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {attentionProducts.slice(0, 4).map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => updateFilter("search", product.name)}
                className="rounded-xl border border-line bg-slate-50 p-3 text-left transition hover:border-brand/40 hover:bg-blue-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-black text-ink">{product.name}</p>
                  <StockBadge product={product} />
                </div>
                <p className="mt-2 text-xs font-bold text-muted">
                  Atual {product.stockQty} · mínimo {product.minStock}
                </p>
              </button>
            ))}
            {!attentionProducts.length ? (
              <div className="rounded-xl border border-line bg-slate-50 p-3">
                <p className="text-sm font-black text-success">Nenhum alerta de reposição</p>
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">Categorias</p>
              <h2 className="mt-2 text-lg font-black text-ink">Produtos por grupo</h2>
            </div>
            <Button variant="secondary" size="sm" onClick={() => updateFilter("category", "")}>
              Todas
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {categoryCounts.length ? (
              categoryCounts.map((category) => (
                <button
                  key={category.value}
                  type="button"
                  onClick={() => updateFilter("category", category.value)}
                  className="rounded-full border border-line bg-slate-50 px-3 py-2 text-xs font-black text-ink transition hover:border-brand/40 hover:bg-blue-50 hover:text-brand"
                >
                  {category.label} · {category.count}
                </button>
              ))
            ) : (
              <p className="text-sm font-bold text-muted">Cadastre produtos para visualizar categorias.</p>
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)] xl:items-start">
        <Card as="form" onSubmit={handleSubmit} className="space-y-4 p-5 xl:sticky xl:top-4 xl:self-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">
              {editing ? "Editar produto" : "Novo produto"}
            </p>
            <h2 className="mt-2 text-xl font-black tracking-tight text-ink">
              {editing ? "Atualizar produto" : view.formTitle}
            </h2>
            <p className="mt-1 text-sm font-medium leading-6 text-muted">
              {view.formDescription}
            </p>
          </div>

          <Field label="Nome">
            <input
              required
              minLength={2}
              value={form.name}
              onChange={(event) => updateForm("name", event.target.value)}
              className={inputClass}
              placeholder="Ex: Óleo finalizador"
            />
          </Field>

          <Field label="Categoria">
            <select value={form.category} onChange={(event) => updateForm("category", event.target.value)} className={inputClass}>
              {productCategories.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Preço de custo">
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.costPrice}
                onChange={(event) => updateForm("costPrice", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Preço de venda">
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.salePrice}
                onChange={(event) => updateForm("salePrice", event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          {hasMarginInputs ? (
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
              <p className="text-sm font-black text-brand">
                Margem: {marginPercent.toFixed(0)}% · Lucro por unidade: {money(profitPerUnit)}
              </p>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Marca">
              <input
                value={form.brand}
                onChange={(event) => updateForm("brand", event.target.value)}
                className={inputClass}
                placeholder="Ex: L'Oréal"
              />
            </Field>
            <Field label="Código de barras / SKU">
              <input
                value={form.sku}
                onChange={(event) => updateForm("sku", event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Fornecedor">
              <input
                value={form.supplierName}
                onChange={(event) => updateForm("supplierName", event.target.value)}
                className={inputClass}
                placeholder="Nome do fornecedor"
              />
            </Field>
            <Field label="Contato do fornecedor">
              <input
                value={form.supplierContact}
                onChange={(event) => updateForm("supplierContact", event.target.value)}
                className={inputClass}
                placeholder="Telefone ou e-mail"
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Unidade de medida">
              <select value={form.unit} onChange={(event) => updateForm("unit", event.target.value)} className={inputClass}>
                {unitOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Validade">
              <input
                type="date"
                value={form.expirationDate}
                onChange={(event) => updateForm("expirationDate", event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Uso do produto">
            <select value={form.usageType} onChange={(event) => updateForm("usageType", event.target.value)} className={inputClass}>
              {usageTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Estoque">
              <input
                required
                type="number"
                min="0"
                value={form.stockQty}
                onChange={(event) => updateForm("stockQty", Number(event.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label="Estoque mínimo">
              <input
                required
                type="number"
                min="0"
                value={form.minStock}
                onChange={(event) => updateForm("minStock", Number(event.target.value))}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Descrição">
            <textarea
              value={form.description}
              onChange={(event) => updateForm("description", event.target.value)}
              className={`${inputClass} min-h-24 resize-none`}
              placeholder="Detalhes opcionais"
            />
          </Field>

          <label className="flex min-h-14 items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-3">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => updateForm("isActive", event.target.checked)}
              className="h-5 w-5 accent-brand"
            />
            <span className="text-sm font-bold text-ink">Ativo para venda</span>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={resetForm} disabled={saving}>
              {editing ? "Cancelar" : "Limpar"}
            </Button>
            <Button type="submit" loading={saving}>{editing ? "Atualizar" : "Cadastrar"}</Button>
          </div>
        </Card>

        <div className="min-w-0 space-y-5">
          <Card className="p-4 sm:p-5">
            <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_180px_auto] lg:items-end">
              <Field label="Buscar">
                <input
                  type="search"
                  value={filters.search}
                  onChange={(event) => updateFilter("search", event.target.value)}
                  className={inputClass}
                  placeholder="Buscar produto"
                />
              </Field>
              <Field label="Categoria">
                <select value={filters.category} onChange={(event) => updateFilter("category", event.target.value)} className={inputClass}>
                  <option value="">Todas</option>
                  {productCategories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Estoque">
                <select value={filters.stock} onChange={(event) => updateFilter("stock", event.target.value)} className={inputClass}>
                  {stockFilters.map((filter) => (
                    <option key={filter.value} value={filter.value}>
                      {filter.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Button variant="secondary" className="w-full lg:w-auto" onClick={resetFilters}>
                Limpar
              </Button>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title={view.listTitle} description={`${products.length} produto(s) encontrados`} />
            <div className="compact-scroll-list divide-y divide-[#E2E8F0]">
              {loading ? (
                <Loading label="Carregando produtos..." />
              ) : products.length ? (
                products.map((product) => {
                  const margin = product.salePrice - product.costPrice;

                  return (
                    <article key={product.id} className="grid gap-4 p-4 transition duration-200 hover:bg-[#F8FAFC] lg:grid-cols-[minmax(0,1fr)_160px_260px] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="break-words text-base font-black leading-6 text-ink">{product.name}</p>
                          <StockBadge product={product} />
                          <ProductStatusBadge active={product.isActive} />
                          {isNearExpiration(product.expirationDate) ? (
                            <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800 ring-1 ring-amber-200">
                              Vence em breve
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm font-bold text-muted">{productCategoryLabel(product.category)}</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          <div className="rounded-2xl bg-slate-50 px-3 py-2">
                            <p className="text-[11px] font-black uppercase text-muted">Custo</p>
                            <p className="mt-1 text-sm font-black text-ink">{money(product.costPrice)}</p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 px-3 py-2">
                            <p className="text-[11px] font-black uppercase text-muted">Venda</p>
                            <p className="mt-1 text-sm font-black text-success">{money(product.salePrice)}</p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 px-3 py-2">
                            <p className="text-[11px] font-black uppercase text-muted">Margem</p>
                            <p className="mt-1 text-sm font-black text-brand">{money(margin)}</p>
                          </div>
                        </div>
                        {product.description ? <p className="mt-3 break-words text-sm leading-6 text-muted">{product.description}</p> : null}
                      </div>

                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 shadow-sm lg:block lg:text-center">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Estoque</p>
                          <p className="mt-1 text-xs font-bold text-muted">mínimo {product.minStock}</p>
                        </div>
                        <p className="text-3xl font-black text-ink lg:mt-2">{product.stockQty}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1">
                        <Button variant="secondary" size="sm" className="w-full" onClick={() => openStockModal(product)}>
                          Adicionar estoque
                        </Button>
                        <Button variant="secondary" size="sm" className="w-full" onClick={() => handleToggle(product)}>
                          {product.isActive ? "Inativar" : "Ativar"}
                        </Button>
                        <Button variant="secondary" size="sm" className="w-full" onClick={() => startEdit(product)}>
                          Editar
                        </Button>
                        <Button variant="danger" size="sm" className="w-full" onClick={() => setPendingDelete(product)}>
                          Excluir
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full"
                          onClick={() => setExpandedProductId((current) => (current === product.id ? "" : product.id))}
                        >
                          {expandedProductId === product.id ? "Ocultar detalhes" : "Detalhes"}
                        </Button>
                      </div>

                      {expandedProductId === product.id ? (
                        <ProductDetailsPanel product={product} showToast={showToast} />
                      ) : null}
                    </article>
                  );
                })
              ) : (
                allProducts.length === 0 ? (
                  <EmptyState
                    title="Cadastre seu primeiro produto"
                    description={`Sugestões para o seu negócio: ${getSuggestedProductNames(user?.businessType).join(", ")}.`}
                    action={
                      <Button size="sm" onClick={() => updateForm("name", getSuggestedProductNames(user?.businessType)[0] || "")}>
                        Usar primeira sugestão
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState title="Nenhum produto encontrado" description="Cadastre produtos ou limpe os filtros." />
                )
              )}
            </div>
          </Card>
        </div>
      </section>

      <AddStockModal
        product={stockTarget}
        amount={stockAmount}
        error={stockError}
        onAmountChange={setStockAmount}
        onConfirm={confirmAddStock}
        onClose={closeStockModal}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Excluir produto?"
        description={pendingDelete ? `${pendingDelete.name} será removido do catálogo. Vendas antigas continuam no histórico.` : ""}
        confirmLabel="Excluir"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

    </div>
  );
}
