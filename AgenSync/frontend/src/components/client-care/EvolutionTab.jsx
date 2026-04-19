import { useEffect, useState } from "react";
import Button from "../Button.jsx";
import ConfirmDialog from "../ConfirmDialog.jsx";
import EmptyState from "../EmptyState.jsx";
import Field, { inputClass } from "../Field.jsx";
import {
  createClientEvolution,
  deleteClientEvolution,
  updateClientEvolution
} from "../../services/clientCare.js";
import { todayInputValue } from "../../utils.js";
import { imageAccept, imageFileToDataUrl } from "./photoUtils.js";

const emptyEvolution = {
  date: todayInputValue(),
  title: "",
  notes: "",
  image: ""
};

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

export default function EvolutionTab({ client, care, onCareChange, showToast }) {
  const [form, setForm] = useState(emptyEvolution);
  const [editingId, setEditingId] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [photoLoading, setPhotoLoading] = useState(false);

  useEffect(() => {
    setForm(emptyEvolution);
    setEditingId("");
    setPendingDelete(null);
    setPhotoLoading(false);
  }, [client.id]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setForm(emptyEvolution);
    setEditingId("");
    setPhotoLoading(false);
  }

  function editEvolution(evolution) {
    setEditingId(evolution.id);
    setForm({
      date: evolution.date,
      title: evolution.title,
      notes: evolution.notes,
      image: evolution.image || ""
    });
  }

  async function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setPhotoLoading(true);
    try {
      const image = await imageFileToDataUrl(file);
      update("image", image);
      showToast("Foto adicionada à evolução.");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setPhotoLoading(false);
      event.target.value = "";
    }
  }

  function saveEvolution(event) {
    event.preventDefault();
    try {
      const nextCare = editingId
        ? updateClientEvolution(client.id, editingId, form)
        : createClientEvolution(client.id, form);
      onCareChange(nextCare);
      showToast(editingId ? "Evolução atualizada." : "Evolução registrada.");
      resetForm();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  function confirmDeleteEvolution() {
    if (!pendingDelete) return;
    const nextCare = deleteClientEvolution(client.id, pendingDelete.id);
    onCareChange(nextCare);
    if (editingId === pendingDelete.id) resetForm();
    setPendingDelete(null);
    showToast("Evolução excluída.");
  }

  return (
    <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] 2xl:items-start">
      <form onSubmit={saveEvolution} className="space-y-4 rounded-xl border border-[#E2E8F0] bg-white p-4">
        <div>
          <h3 className="text-lg font-black text-ink">{editingId ? "Editar evolução" : "Nova evolução"}</h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            Registre retorno, observações clínicas, intercorrências e próximos cuidados.
          </p>
        </div>

        <Field label="Data">
          <input type="date" required value={form.date} onChange={(event) => update("date", event.target.value)} className={inputClass} />
        </Field>
        <Field label="Título">
          <input
            required
            minLength={2}
            value={form.title}
            onChange={(event) => update("title", event.target.value)}
            className={inputClass}
            placeholder="Retorno pós-procedimento"
          />
        </Field>
        <Field label="Evolução / observações">
          <textarea
            required
            minLength={2}
            value={form.notes}
            onChange={(event) => update("notes", event.target.value)}
            className={`${inputClass} min-h-44 resize-none`}
            placeholder="Descreva evolução, queixas, orientação e plano de continuidade"
          />
        </Field>
        <Field label="Foto da evolução">
          <div className="space-y-3">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4 text-center transition hover:border-brand/50 hover:bg-blue-50">
              <input type="file" accept={imageAccept()} className="sr-only" onChange={handlePhotoChange} />
              <span className="text-sm font-black text-ink">{photoLoading ? "Preparando foto..." : "Adicionar foto"}</span>
              <span className="mt-1 text-xs font-bold text-muted">PNG, JPG ou WEBP até 6 MB.</span>
            </label>

            {form.image ? (
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-2">
                <img src={form.image} alt="Foto da evolução" className="h-40 w-full rounded-lg object-cover" />
                <Button variant="secondary" size="sm" className="mt-2 w-full" onClick={() => update("image", "")}>
                  Remover foto
                </Button>
              </div>
            ) : null}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-2">
          {editingId ? (
            <Button variant="secondary" onClick={resetForm}>
              Cancelar
            </Button>
          ) : null}
          <Button type="submit" className={editingId ? "" : "col-span-2"}>
            {editingId ? "Atualizar" : "Salvar evolução"}
          </Button>
        </div>
      </form>

      <div className="min-w-0 space-y-3">
        <h3 className="text-lg font-black text-ink">Evoluções do cliente</h3>
        {care.evolutions.length ? (
          care.evolutions.map((evolution) => (
            <article key={evolution.id} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                <div className="min-w-0">
                  <p className="text-base font-black text-ink">{evolution.title}</p>
                  <p className="mt-1 text-xs font-bold text-muted">
                    {evolution.date} · Atualizada em {formatDateTime(evolution.updatedAt)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" size="sm" onClick={() => editEvolution(evolution)}>
                    Editar
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setPendingDelete(evolution)}>
                    Excluir
                  </Button>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap rounded-xl bg-[#F8FAFC] p-3 text-sm leading-6 text-muted">
                {evolution.notes}
              </p>
              {evolution.image ? (
                <div className="mt-3 overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
                  <img src={evolution.image} alt={`Foto da evolução ${evolution.title}`} className="h-56 w-full object-cover" />
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <EmptyState title="Nenhuma evolução registrada" description="Registre retornos, acompanhamentos e observações importantes." />
        )}
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Excluir evolução?"
        description={pendingDelete ? `${pendingDelete.title} será removida do prontuário.` : ""}
        confirmLabel="Excluir"
        danger
        onConfirm={confirmDeleteEvolution}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
