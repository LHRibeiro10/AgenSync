import { useEffect, useState } from "react";
import Button from "../Button.jsx";
import Field, { inputClass } from "../Field.jsx";
import { emptyAnamnesis, saveClientAnamnesis } from "../../services/clientCare.js";

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

export default function AnamnesisTab({ clientId, care, onCareChange, showToast }) {
  const [form, setForm] = useState({ ...emptyAnamnesis });

  useEffect(() => {
    setForm({ ...emptyAnamnesis, ...care.anamnesis });
  }, [clientId, care.anamnesis]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const nextCare = saveClientAnamnesis(clientId, form);
    onCareChange(nextCare);
    showToast("Ficha de anamnese salva.");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
        <p className="text-sm font-bold text-ink">Ficha de anamnese</p>
        <p className="mt-1 text-sm leading-6 text-muted">
          Registre informações importantes antes do procedimento e mantenha tudo no histórico do cliente.
        </p>
        {form.updatedAt ? (
          <p className="mt-2 text-xs font-bold text-brand">Última atualização: {formatDateTime(form.updatedAt)}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Observações gerais">
          <textarea
            value={form.generalNotes}
            onChange={(event) => update("generalNotes", event.target.value)}
            className={`${inputClass} min-h-32 resize-none`}
            placeholder="Objetivo do atendimento, preferências e cuidados"
          />
        </Field>
        <Field label="Alergias">
          <textarea
            value={form.allergies}
            onChange={(event) => update("allergies", event.target.value)}
            className={`${inputClass} min-h-32 resize-none`}
            placeholder="Medicamentos, cosméticos, látex, cola, anestésicos"
          />
        </Field>
        <Field label="Condições da pele">
          <textarea
            value={form.skinConditions}
            onChange={(event) => update("skinConditions", event.target.value)}
            className={`${inputClass} min-h-32 resize-none`}
            placeholder="Sensibilidade, acne, manchas, oleosidade, cicatrizes"
          />
        </Field>
        <Field label="Produtos utilizados">
          <textarea
            value={form.productsUsed}
            onChange={(event) => update("productsUsed", event.target.value)}
            className={`${inputClass} min-h-32 resize-none`}
            placeholder="Produtos em uso, ácidos, home care e restrições"
          />
        </Field>
      </div>

      <Field label="Notas livres">
        <textarea
          value={form.freeNotes}
          onChange={(event) => update("freeNotes", event.target.value)}
          className={`${inputClass} min-h-32 resize-none`}
          placeholder="Qualquer detalhe adicional relevante"
        />
      </Field>

      <Button type="submit" className="w-full sm:w-auto">
        Salvar ficha
      </Button>
    </form>
  );
}
