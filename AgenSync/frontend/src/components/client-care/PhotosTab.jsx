import { useEffect, useState } from "react";
import Button from "../Button.jsx";
import ConfirmDialog from "../ConfirmDialog.jsx";
import EmptyState from "../EmptyState.jsx";
import Field, { inputClass } from "../Field.jsx";
import { addClientPhotos, deleteClientPhoto, updateClientPhoto } from "../../services/clientCare.js";
import { imageAccept, imageFileToDataUrl } from "./photoUtils.js";

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

export default function PhotosTab({ client, care, onCareChange, showToast }) {
  const [caption, setCaption] = useState("");
  const [linkedFormId, setLinkedFormId] = useState("");
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [photoEdits, setPhotoEdits] = useState({});
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    setCaption("");
    setLinkedFormId("");
    setFiles([]);
    setSaving(false);
    setPhotoEdits({});
    setPreviewPhoto(null);
    setPendingDelete(null);
  }, [client.id]);

  function updateEdit(photoId, field, value) {
    setPhotoEdits((current) => ({
      ...current,
      [photoId]: {
        ...(current[photoId] || {}),
        [field]: value
      }
    }));
  }

  async function savePhotos(event) {
    event.preventDefault();
    if (!files.length) {
      showToast("Selecione ao menos uma foto.", "error");
      return;
    }

    setSaving(true);
    try {
      const photos = [];
      for (const file of files) {
        const image = await imageFileToDataUrl(file, 1000);
        photos.push({ image, caption, linkedFormId });
      }
      const nextCare = addClientPhotos(client.id, photos);
      onCareChange(nextCare);
      setCaption("");
      setLinkedFormId("");
      setFiles([]);
      showToast(`${photos.length} foto(s) anexada(s).`);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  function savePhotoEdit(photo) {
    const edit = photoEdits[photo.id] || {};
    const nextCare = updateClientPhoto(client.id, photo.id, {
      caption: edit.caption === undefined ? photo.caption : edit.caption,
      linkedFormId: edit.linkedFormId === undefined ? photo.linkedFormId : edit.linkedFormId
    });
    onCareChange(nextCare);
    setPhotoEdits((current) => ({ ...current, [photo.id]: undefined }));
    showToast("Foto atualizada.");
  }

  function confirmDeletePhoto() {
    if (!pendingDelete) return;
    const nextCare = deleteClientPhoto(client.id, pendingDelete.id);
    onCareChange(nextCare);
    if (previewPhoto?.id === pendingDelete.id) setPreviewPhoto(null);
    setPendingDelete(null);
    showToast("Foto excluída.");
  }

  return (
    <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] 2xl:items-start">
      <form onSubmit={savePhotos} className="space-y-4 rounded-xl border border-[#E2E8F0] bg-white p-4">
        <div>
          <h3 className="text-lg font-black text-ink">Anexar fotos</h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            Registre antes e depois, documentos fotografados ou evolução visual do atendimento.
          </p>
        </div>

        <Field label="Fotos">
          <input
            type="file"
            accept={imageAccept()}
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files || []))}
            className={inputClass}
          />
        </Field>

        <Field label="Legenda padrão">
          <input
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            className={inputClass}
            placeholder="Antes do procedimento, retorno de 30 dias..."
          />
        </Field>

        <Field label="Vincular a ficha">
          <select value={linkedFormId} onChange={(event) => setLinkedFormId(event.target.value)} className={inputClass}>
            <option value="">Sem vínculo específico</option>
            {care.forms.map((form) => (
              <option key={form.id} value={form.id}>
                {form.title || form.templateName}
              </option>
            ))}
          </select>
        </Field>

        {files.length ? (
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-bold text-brand">
            {files.length} arquivo(s) selecionado(s).
          </div>
        ) : null}

        <Button type="submit" loading={saving} className="w-full">
          Salvar fotos
        </Button>
      </form>

      <div className="min-w-0 space-y-3">
        <h3 className="text-lg font-black text-ink">Fotos do prontuário</h3>
        {care.photos.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {care.photos.map((photo) => {
              const edit = photoEdits[photo.id] || {};
              const linkedForm = care.forms.find((form) => form.id === photo.linkedFormId);

              return (
                <article key={photo.id} className="min-w-0 rounded-xl border border-[#E2E8F0] bg-white p-3">
                  <button type="button" onClick={() => setPreviewPhoto(photo)} className="block w-full overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
                    <img src={photo.image} alt={photo.caption || "Foto do cliente"} className="h-44 w-full object-cover" />
                  </button>
                  <p className="mt-3 text-xs font-bold text-muted">Anexada em {formatDateTime(photo.createdAt)}</p>
                  {linkedForm ? <p className="mt-1 text-xs font-black text-brand">Ficha: {linkedForm.title || linkedForm.templateName}</p> : null}

                  <div className="mt-3 space-y-2">
                    <input
                      value={edit.caption ?? photo.caption}
                      onChange={(event) => updateEdit(photo.id, "caption", event.target.value)}
                      className={inputClass}
                      placeholder="Legenda"
                    />
                    <select
                      value={edit.linkedFormId ?? photo.linkedFormId}
                      onChange={(event) => updateEdit(photo.id, "linkedFormId", event.target.value)}
                      className={inputClass}
                    >
                      <option value="">Sem vínculo</option>
                      {care.forms.map((form) => (
                        <option key={form.id} value={form.id}>
                          {form.title || form.templateName}
                        </option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="secondary" size="sm" onClick={() => savePhotoEdit(photo)}>
                        Salvar
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => setPendingDelete(photo)}>
                        Excluir
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title="Nenhuma foto anexada" description="Adicione fotos de antes/depois, documentos ou evolução do cliente." />
        )}
      </div>

      {previewPhoto ? (
        <div className="agensync-overlay z-50 flex items-end bg-ink/45 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
          <div className="w-full max-w-4xl rounded-xl bg-white p-4 shadow-panel">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-black text-ink">{previewPhoto.caption || "Foto do cliente"}</p>
                <p className="text-sm text-muted">{formatDateTime(previewPhoto.createdAt)}</p>
              </div>
              <Button variant="secondary" onClick={() => setPreviewPhoto(null)}>
                Fechar
              </Button>
            </div>
            <img src={previewPhoto.image} alt={previewPhoto.caption || "Foto ampliada"} className="mt-4 max-h-[72vh] w-full rounded-xl bg-[#F8FAFC] object-contain" />
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Excluir foto?"
        description={pendingDelete ? "A imagem será removida do prontuário do cliente." : ""}
        confirmLabel="Excluir"
        danger
        onConfirm={confirmDeletePhoto}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
