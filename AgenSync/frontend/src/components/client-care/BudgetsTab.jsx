import { useEffect, useMemo, useState } from "react";
import Button from "../Button.jsx";
import EmptyState from "../EmptyState.jsx";
import Field, { inputClass } from "../Field.jsx";
import { createClientBudget, signClientBudget } from "../../services/clientCare.js";
import { money, todayInputValue } from "../../utils.js";
import BudgetWhatsAppModal from "./BudgetWhatsAppModal.jsx";
import SignaturePad from "./SignaturePad.jsx";

function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function BudgetsTab({ client, care, services, products, onCareChange, showToast }) {
  const [date, setDate] = useState(todayInputValue());
  const [serviceId, setServiceId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [serviceLines, setServiceLines] = useState([]);
  const [productLines, setProductLines] = useState([]);
  const [notes, setNotes] = useState("");
  const [signatureTarget, setSignatureTarget] = useState("");
  const [whatsAppBudget, setWhatsAppBudget] = useState(null);

  useEffect(() => {
    setDate(todayInputValue());
    setServiceId("");
    setProductId("");
    setQuantity(1);
    setServiceLines([]);
    setProductLines([]);
    setNotes("");
    setSignatureTarget("");
    setWhatsAppBudget(null);
  }, [client.id]);

  const total = useMemo(() => {
    const servicesTotal = serviceLines.reduce((sum, item) => sum + Number(item.price || 0), 0);
    const productsTotal = productLines.reduce((sum, item) => sum + Number(item.total || 0), 0);
    return servicesTotal + productsTotal;
  }, [serviceLines, productLines]);

  function addService() {
    const service = services.find((item) => item.id === serviceId);
    if (!service) return;
    setServiceLines((current) => [
      ...current,
      {
        id: `line_service_${Date.now()}_${service.id}`,
        serviceId: service.id,
        name: service.name,
        price: Number(service.priceDefault || 0)
      }
    ]);
    setServiceId("");
  }

  function addProduct() {
    const product = products.find((item) => item.id === productId);
    const safeQuantity = Number(quantity);
    if (!product || !Number.isInteger(safeQuantity) || safeQuantity <= 0) return;
    setProductLines((current) => [
      ...current,
      {
        id: `line_product_${Date.now()}_${product.id}`,
        productId: product.id,
        name: product.name,
        quantity: safeQuantity,
        unitPrice: Number(product.salePrice || 0),
        total: Number(product.salePrice || 0) * safeQuantity
      }
    ]);
    setProductId("");
    setQuantity(1);
  }

  function saveBudget(event) {
    event.preventDefault();
    const nextCare = createClientBudget(client.id, {
      date,
      services: serviceLines,
      products: productLines,
      notes
    });
    onCareChange(nextCare);
    showToast("Orçamento salvo.");
    setServiceLines([]);
    setProductLines([]);
    setNotes("");
  }

  function handleSignature(budgetId, signatureImage) {
    const nextCare = signClientBudget(client.id, budgetId, signatureImage);
    onCareChange(nextCare);
    showToast("Assinatura vinculada ao orçamento.");
    setSignatureTarget("");
  }

  return (
    <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(340px,460px)_minmax(0,1fr)] 2xl:items-start">
      <form onSubmit={saveBudget} className="min-w-0 space-y-4">
        <div>
          <h3 className="text-lg font-black text-ink">Novo orçamento</h3>
          <p className="mt-1 text-sm leading-6 text-muted">Adicione serviços e produtos. O total é calculado automaticamente.</p>
        </div>

        <Field label="Data">
          <input type="date" required value={date} onChange={(event) => setDate(event.target.value)} className={inputClass} />
        </Field>

        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
          <Field label="Adicionar serviço">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <select value={serviceId} onChange={(event) => setServiceId(event.target.value)} className={inputClass}>
                <option value="">Selecione um serviço</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} · {money(service.priceDefault)}
                  </option>
                ))}
              </select>
              <Button onClick={addService} disabled={!serviceId}>
                Adicionar
              </Button>
            </div>
          </Field>
        </div>

        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
          <Field label="Adicionar produto">
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_90px_auto]">
              <select value={productId} onChange={(event) => setProductId(event.target.value)} className={inputClass}>
                <option value="">Selecione um produto</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} · {money(product.salePrice)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                className={inputClass}
                aria-label="Quantidade"
              />
              <Button onClick={addProduct} disabled={!productId}>
                Adicionar
              </Button>
            </div>
          </Field>
        </div>

        <div className="space-y-2">
          {[...serviceLines, ...productLines].length ? (
            <>
              {serviceLines.map((item) => (
                <div key={item.id} className="grid gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                  <span className="min-w-0 truncate text-sm font-bold text-ink">{item.name}</span>
                  <span className="text-sm font-black text-success">{money(item.price)}</span>
                  <button type="button" onClick={() => setServiceLines((current) => current.filter((line) => line.id !== item.id))} className="text-sm font-black text-danger">
                    Remover
                  </button>
                </div>
              ))}
              {productLines.map((item) => (
                <div key={item.id} className="grid gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                  <span className="min-w-0 truncate text-sm font-bold text-ink">
                    {item.name} · {item.quantity} un.
                  </span>
                  <span className="text-sm font-black text-success">{money(item.total)}</span>
                  <button type="button" onClick={() => setProductLines((current) => current.filter((line) => line.id !== item.id))} className="text-sm font-black text-danger">
                    Remover
                  </button>
                </div>
              ))}
            </>
          ) : (
            <p className="rounded-xl border border-dashed border-[#CBD5E1] bg-white px-3 py-4 text-sm font-bold text-muted">
              Adicione serviços ou produtos para montar o orçamento.
            </p>
          )}
        </div>

        <Field label="Observações">
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className={`${inputClass} min-h-24 resize-none`}
            placeholder="Validade, formas de pagamento ou cuidados inclusos"
          />
        </Field>

        <div className="flex flex-col gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-muted">Total do orçamento</p>
            <p className="text-2xl font-black text-success">{money(total)}</p>
          </div>
          <Button type="submit" className="w-full sm:w-auto">Salvar orçamento</Button>
        </div>
      </form>

      <div className="min-w-0 space-y-3">
        <h3 className="text-lg font-black text-ink">Orçamentos do cliente</h3>
        {care.budgets.length ? (
          care.budgets.map((budget) => (
            <article key={budget.id} className="min-w-0 rounded-xl border border-[#E2E8F0] bg-white p-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,auto)] xl:items-start">
                <div className="min-w-0">
                  <p className="text-base font-black text-ink">Orçamento de {budget.date}</p>
                  <p className="mt-1 text-xs font-bold text-muted">Salvo em {formatDateTime(budget.createdAt)}</p>
                  {budget.signedAt ? <p className="mt-1 text-xs font-bold text-success">Assinado em {formatDateTime(budget.signedAt)}</p> : null}
                </div>
                <div className="text-left xl:text-right">
                  <p className="text-2xl font-black text-success">{money(budget.total)}</p>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
                    <Button variant="secondary" className="w-full" onClick={() => setSignatureTarget(signatureTarget === budget.id ? "" : budget.id)}>
                      Assinar
                    </Button>
                    <Button variant="secondary" className="w-full" onClick={() => setWhatsAppBudget(budget)}>
                      Enviar por WhatsApp
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-[#F8FAFC] p-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Serviços</p>
                  {budget.services.length ? (
                    budget.services.map((item) => (
                      <p key={item.id} className="mt-2 text-sm font-bold text-ink">
                        {item.name} · {money(item.price)}
                      </p>
                    ))
                  ) : (
                    <p className="mt-2 text-sm text-muted">Sem serviços.</p>
                  )}
                </div>
                <div className="rounded-xl bg-[#F8FAFC] p-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Produtos</p>
                  {budget.products.length ? (
                    budget.products.map((item) => (
                      <p key={item.id} className="mt-2 text-sm font-bold text-ink">
                        {item.name} · {item.quantity} un. · {money(item.total)}
                      </p>
                    ))
                  ) : (
                    <p className="mt-2 text-sm text-muted">Sem produtos.</p>
                  )}
                </div>
              </div>
              {budget.notes ? <p className="mt-3 rounded-xl bg-[#F8FAFC] p-3 text-sm text-muted">{budget.notes}</p> : null}
              {signatureTarget === budget.id ? (
                <div className="mt-3">
                  <SignaturePad
                    existingImage={budget.signatureImage}
                    onSave={(signatureImage) => handleSignature(budget.id, signatureImage)}
                  />
                </div>
              ) : budget.signatureImage ? (
                <img
                  src={budget.signatureImage}
                  alt="Assinatura do orçamento"
                  className="mt-3 h-20 w-full rounded-xl border border-[#E2E8F0] bg-white object-contain"
                />
              ) : null}
            </article>
          ))
        ) : (
          <EmptyState title="Nenhum orçamento" description="Monte uma proposta com serviços, produtos e assinatura." />
        )}
      </div>

      <BudgetWhatsAppModal
        open={Boolean(whatsAppBudget)}
        client={client}
        budget={whatsAppBudget}
        onClose={() => setWhatsAppBudget(null)}
        showToast={showToast}
      />
    </div>
  );
}
