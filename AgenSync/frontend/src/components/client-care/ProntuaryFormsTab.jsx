import { useEffect, useMemo, useState } from "react";
import Button from "../Button.jsx";
import ConfirmDialog from "../ConfirmDialog.jsx";
import EmptyState from "../EmptyState.jsx";
import Field, { inputClass } from "../Field.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import {
  createFormTemplate,
  deleteClientForm,
  deleteFormTemplate,
  duplicateClientForm,
  duplicateFormTemplate,
  getFichaHistory,
  listFormTemplates,
  saveClientForm,
  updateFormTemplate
} from "../../services/clientCare.js";
import AnamnesisTab from "./AnamnesisTab.jsx";
import SignaturePad from "./SignaturePad.jsx";
import { imageAccept, imageFileToDataUrl } from "./photoUtils.js";

const fieldTypes = [
  { value: "shortText", label: "Texto curto" },
  { value: "longText", label: "Texto longo" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
  { value: "singleSelect", label: "Seleção única" },
  { value: "multiSelect", label: "Múltipla escolha" },
  { value: "checkbox", label: "Checkbox" },
  { value: "signature", label: "Assinatura" },
  { value: "image", label: "Upload de imagem/foto" }
];

const blankField = () => ({
  id: `field_${Date.now()}_${Math.random().toString(16).slice(2)}`,
  label: "",
  type: "shortText",
  required: false,
  options: []
});

const blankTemplate = () => ({
  id: "",
  name: "",
  description: "",
  fields: [blankField()]
});

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

function templateToForm(template) {
  if (!template) return blankTemplate();
  return {
    id: template.id,
    name: template.name,
    description: template.description || "",
    fields: template.fields.map((field) => ({
      ...field,
      optionsText: (field.options || []).join(", ")
    }))
  };
}

function cleanTemplateForm(form) {
  return {
    name: form.name,
    description: form.description,
    fields: form.fields
      .map((field) => ({
        id: field.id,
        label: field.label,
        type: field.type,
        required: field.required,
        options: String(field.optionsText || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      }))
      .filter((field) => field.label.trim())
  };
}

function emptyRecordFromTemplate(template) {
  return {
    id: "",
    templateId: template.id,
    templateName: template.name,
    title: template.name,
    fields: template.fields,
    values: {}
  };
}

function isValueEmpty(value, type) {
  if (type === "checkbox") return value !== true;
  if (type === "multiSelect") return !Array.isArray(value) || !value.length;
  return value === undefined || value === null || String(value).trim() === "";
}

function FieldValuePreview({ field, value }) {
  if (field.type === "signature" && value) {
    return <img src={value} alt={field.label} className="mt-2 h-20 w-full rounded-xl border border-[#E2E8F0] bg-white object-contain" />;
  }

  if (field.type === "image" && value) {
    return <img src={value} alt={field.label} className="mt-2 h-28 w-full rounded-xl border border-[#E2E8F0] bg-white object-contain" />;
  }

  if (field.type === "checkbox") {
    return <p className="text-sm font-bold text-ink">{value ? "Sim" : "Não"}</p>;
  }

  if (Array.isArray(value)) {
    return <p className="text-sm font-bold text-ink">{value.length ? value.join(", ") : "-"}</p>;
  }

  return <p className="whitespace-pre-wrap text-sm font-bold text-ink">{value || "-"}</p>;
}

function RecordFieldShell({ field, children }) {
  return (
    <div className="block">
      <p className="text-sm font-black text-ink">
        {field.label}
        {field.required ? " *" : ""}
      </p>
      <div className="mt-1">{children}</div>
      {field.type === "signature" ? (
        <p className="mt-1 text-xs text-muted">
          Desenhe no canvas, clique em salvar assinatura e depois salve a ficha.
        </p>
      ) : null}
    </div>
  );
}

export default function ProntuaryFormsTab({ client, care, onCareChange, showToast }) {
  const { user } = useAuth();
  const businessType = user?.businessType;
  const [templates, setTemplates] = useState(() => listFormTemplates(businessType));
  const [templateForm, setTemplateForm] = useState(() => templateToForm(listFormTemplates(businessType)[0]));
  const [recordForm, setRecordForm] = useState(null);
  const [showLegacyAnamnesis, setShowLegacyAnamnesis] = useState(false);
  const [pendingTemplateDelete, setPendingTemplateDelete] = useState(null);
  const [pendingFormDelete, setPendingFormDelete] = useState(null);
  const [fichaHistory, setFichaHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const nextTemplates = listFormTemplates(businessType);
    setTemplates(nextTemplates);
    setTemplateForm(templateToForm(nextTemplates[0]));
    setRecordForm(null);
    setShowLegacyAnamnesis(false);
    setPendingTemplateDelete(null);
    setPendingFormDelete(null);
    setShowHistory(false);
    setFichaHistory([]);
  }, [client.id, businessType]);

  useEffect(() => {
    function refreshFromStorage(event) {
      if (event.type === "storage" && event.key !== "agensync_form_templates_v1") return;
      const nextTemplates = listFormTemplates(businessType);
      setTemplates(nextTemplates);
      setTemplateForm((current) => {
        const selected = nextTemplates.find((template) => template.id === current.id) || nextTemplates[0];
        return templateToForm(selected);
      });
    }

    window.addEventListener("storage", refreshFromStorage);
    window.addEventListener("agensync:form-templates-updated", refreshFromStorage);

    return () => {
      window.removeEventListener("storage", refreshFromStorage);
      window.removeEventListener("agensync:form-templates-updated", refreshFromStorage);
    };
  }, [businessType]);

  function toggleHistory() {
    setShowHistory((current) => {
      const next = !current;
      if (next && client.id) {
        getFichaHistory(client.id)
          .then(setFichaHistory)
          .catch((err) => showToast(err.message, "error"));
      }
      return next;
    });
  }

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === templateForm.id) || templates[0],
    [templateForm.id, templates]
  );

  function refreshTemplates(nextTemplates = listFormTemplates(), selectedId = "") {
    setTemplates(nextTemplates);
    const selected = nextTemplates.find((template) => template.id === selectedId) || nextTemplates[0];
    setTemplateForm(templateToForm(selected));
  }

  function startBlankTemplate() {
    setTemplateForm(blankTemplate());
  }

  function selectTemplate(templateId) {
    const template = templates.find((item) => item.id === templateId);
    if (template) setTemplateForm(templateToForm(template));
  }

  function updateTemplate(field, value) {
    setTemplateForm((current) => ({ ...current, [field]: value }));
  }

  function updateTemplateField(fieldId, key, value) {
    setTemplateForm((current) => ({
      ...current,
      fields: current.fields.map((field) => (field.id === fieldId ? { ...field, [key]: value } : field))
    }));
  }

  function addField() {
    setTemplateForm((current) => ({ ...current, fields: [...current.fields, blankField()] }));
  }

  function removeField(fieldId) {
    setTemplateForm((current) => ({
      ...current,
      fields: current.fields.length > 1 ? current.fields.filter((field) => field.id !== fieldId) : current.fields
    }));
  }

  function saveTemplate(event) {
    event.preventDefault();
    try {
      const payload = cleanTemplateForm(templateForm);
      const nextTemplates = templateForm.id
        ? updateFormTemplate(templateForm.id, payload)
        : createFormTemplate(payload);
      const selectedId = templateForm.id || nextTemplates[0]?.id;
      refreshTemplates(nextTemplates, selectedId);
      showToast(templateForm.id ? "Modelo atualizado." : "Modelo criado.");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  function duplicateTemplate() {
    if (!selectedTemplate) return;
    try {
      const nextTemplates = duplicateFormTemplate(selectedTemplate.id);
      refreshTemplates(nextTemplates, nextTemplates[0]?.id);
      showToast("Modelo duplicado.");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  function confirmDeleteTemplate() {
    if (!pendingTemplateDelete) return;
    const nextTemplates = deleteFormTemplate(pendingTemplateDelete.id);
    refreshTemplates(nextTemplates);
    showToast("Modelo excluído.");
    setPendingTemplateDelete(null);
  }

  function applyTemplate(template = selectedTemplate) {
    if (!template) return;
    setRecordForm(emptyRecordFromTemplate(template));
  }

  function editRecord(record) {
    setRecordForm({
      id: record.id,
      templateId: record.templateId,
      templateName: record.templateName,
      title: record.title || record.templateName,
      fields: record.fields,
      values: record.values || {}
    });
  }

  function updateRecordValue(fieldId, value) {
    setRecordForm((current) => ({
      ...current,
      values: {
        ...(current?.values || {}),
        [fieldId]: value
      }
    }));
  }

  async function uploadFieldImage(fieldId, file) {
    if (!file) return;
    try {
      const image = await imageFileToDataUrl(file, 900);
      updateRecordValue(fieldId, image);
      showToast("Imagem adicionada à ficha.");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  function saveRecord(event) {
    event.preventDefault();
    if (!recordForm) return;

    const missing = recordForm.fields.find((field) => field.required && isValueEmpty(recordForm.values[field.id], field.type));
    if (missing) {
      showToast(`Preencha o campo obrigatório: ${missing.label}`, "error");
      return;
    }

    try {
      const nextCare = saveClientForm(client.id, recordForm);
      onCareChange(nextCare);
      setRecordForm(null);
      showToast(recordForm.id ? "Ficha atualizada." : "Ficha salva no prontuário.");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  function duplicateRecord(recordId) {
    try {
      const nextCare = duplicateClientForm(client.id, recordId);
      onCareChange(nextCare);
      showToast("Ficha duplicada.");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  function confirmDeleteRecord() {
    if (!pendingFormDelete) return;
    const nextCare = deleteClientForm(client.id, pendingFormDelete.id);
    onCareChange(nextCare);
    if (recordForm?.id === pendingFormDelete.id) setRecordForm(null);
    setPendingFormDelete(null);
    showToast("Ficha excluída.");
  }

  function renderRecordField(field) {
    const value = recordForm?.values?.[field.id];

    if (field.type === "longText") {
      return (
        <textarea
          value={value || ""}
          onChange={(event) => updateRecordValue(field.id, event.target.value)}
          className={`${inputClass} min-h-28 resize-none`}
          required={field.required}
        />
      );
    }

    if (field.type === "number") {
      return (
        <input
          type="number"
          value={value || ""}
          onChange={(event) => updateRecordValue(field.id, event.target.value)}
          className={inputClass}
          required={field.required}
        />
      );
    }

    if (field.type === "date") {
      return (
        <input
          type="date"
          value={value || ""}
          onChange={(event) => updateRecordValue(field.id, event.target.value)}
          className={inputClass}
          required={field.required}
        />
      );
    }

    if (field.type === "singleSelect") {
      return (
        <select
          value={value || ""}
          onChange={(event) => updateRecordValue(field.id, event.target.value)}
          className={inputClass}
          required={field.required}
        >
          <option value="">Selecione</option>
          {(field.options || []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === "multiSelect") {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="grid gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 sm:grid-cols-2">
          {(field.options || []).map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm font-bold text-ink">
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={(event) => {
                  updateRecordValue(
                    field.id,
                    event.target.checked ? [...selected, option] : selected.filter((item) => item !== option)
                  );
                }}
                className="h-4 w-4 accent-brand"
              />
              {option}
            </label>
          ))}
        </div>
      );
    }

    if (field.type === "checkbox") {
      return (
        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm font-black text-ink">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => updateRecordValue(field.id, event.target.checked)}
            className="h-5 w-5 accent-brand"
          />
          Marcar como sim
        </label>
      );
    }

    if (field.type === "signature") {
      return (
        <SignaturePad
          existingImage={value || ""}
          onSave={(signatureImage) => updateRecordValue(field.id, signatureImage)}
        />
      );
    }

    if (field.type === "image") {
      return (
        <div className="space-y-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
          {value ? (
            <img src={value} alt={field.label} className="h-44 w-full rounded-xl border border-[#E2E8F0] bg-white object-contain" />
          ) : null}
          <input
            type="file"
            accept={imageAccept()}
            onChange={(event) => uploadFieldImage(field.id, event.target.files?.[0])}
            className={inputClass}
          />
          {value ? (
            <Button variant="secondary" onClick={() => updateRecordValue(field.id, "")}>
              Remover imagem
            </Button>
          ) : null}
        </div>
      );
    }

    return (
      <input
        value={value || ""}
        onChange={(event) => updateRecordValue(field.id, event.target.value)}
        className={inputClass}
        required={field.required}
      />
    );
  }

  return (
    <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(320px,440px)_minmax(0,1fr)] 2xl:items-start">
      <div className="min-w-0 space-y-5">
        <form onSubmit={saveTemplate} className="space-y-4 rounded-xl border border-[#E2E8F0] bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-black text-ink">Modelos de ficha</h3>
              <p className="mt-1 text-sm leading-6 text-muted">Crie estruturas reutilizáveis para anamnese, avaliação e retorno.</p>
            </div>
            <Button variant="secondary" onClick={startBlankTemplate}>
              Novo modelo
            </Button>
          </div>

          <Field label="Selecionar modelo">
            <select value={templateForm.id} onChange={(event) => selectTemplate(event.target.value)} className={inputClass}>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome do modelo">
              <input
                required
                minLength={2}
                value={templateForm.name}
                onChange={(event) => updateTemplate("name", event.target.value)}
                className={inputClass}
                placeholder="Ficha de anamnese facial"
              />
            </Field>
            <Field label="Descrição">
              <input
                value={templateForm.description}
                onChange={(event) => updateTemplate("description", event.target.value)}
                className={inputClass}
                placeholder="Quando usar esse modelo"
              />
            </Field>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-black text-ink">Campos da ficha</p>
              <Button variant="secondary" size="sm" onClick={addField}>
                Adicionar campo
              </Button>
            </div>
            {templateForm.fields.map((field, index) => (
              <div key={field.id} className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_160px]">
                  <input
                    value={field.label}
                    onChange={(event) => updateTemplateField(field.id, "label", event.target.value)}
                    className={inputClass}
                    placeholder={`Campo ${index + 1}`}
                    required
                  />
                  <select
                    value={field.type}
                    onChange={(event) => updateTemplateField(field.id, "type", event.target.value)}
                    className={inputClass}
                  >
                    {fieldTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                {["singleSelect", "multiSelect"].includes(field.type) ? (
                  <input
                    value={field.optionsText || ""}
                    onChange={(event) => updateTemplateField(field.id, "optionsText", event.target.value)}
                    className={`${inputClass} mt-2`}
                    placeholder="Opções separadas por vírgula"
                  />
                ) : null}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs font-black text-muted">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(event) => updateTemplateField(field.id, "required", event.target.checked)}
                      className="h-4 w-4 accent-brand"
                    />
                    Obrigatório
                  </label>
                  <button type="button" onClick={() => removeField(field.id)} className="text-xs font-black text-danger">
                    Remover campo
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="submit">{templateForm.id ? "Salvar modelo" : "Criar modelo"}</Button>
            <Button variant="secondary" onClick={() => applyTemplate()}>
              Aplicar ao cliente
            </Button>
            {templateForm.id ? (
              <>
                <Button variant="secondary" onClick={duplicateTemplate}>
                  Duplicar modelo
                </Button>
                <Button variant="danger" onClick={() => setPendingTemplateDelete(selectedTemplate)}>
                  Excluir modelo
                </Button>
              </>
            ) : null}
          </div>
        </form>

        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-ink">Anamnese clássica</p>
              <p className="mt-1 text-xs font-bold text-brand">
                {care.anamnesis?.updatedAt ? `Atualizada em ${formatDateTime(care.anamnesis.updatedAt)}` : "Disponível para compatibilidade"}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setShowLegacyAnamnesis((current) => !current)}>
              {showLegacyAnamnesis ? "Ocultar" : "Editar clássica"}
            </Button>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted">
            A ficha antiga continua editável para preservar o fluxo que já existia.
          </p>
        </div>

        {showLegacyAnamnesis ? (
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
            <AnamnesisTab clientId={client.id} care={care} onCareChange={onCareChange} showToast={showToast} />
          </div>
        ) : null}
      </div>

      <div className="min-w-0 space-y-5">
        {recordForm ? (
          <form onSubmit={saveRecord} className="space-y-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">Ficha do cliente</p>
                <h3 className="mt-1 text-xl font-black text-ink">{recordForm.id ? "Editar ficha" : "Preencher nova ficha"}</h3>
              </div>
              <Button variant="secondary" onClick={() => setRecordForm(null)}>
                Fechar
              </Button>
            </div>
            <Field label="Título da ficha">
              <input
                required
                value={recordForm.title}
                onChange={(event) => setRecordForm((current) => ({ ...current, title: event.target.value }))}
                className={inputClass}
              />
            </Field>
            <div className="grid gap-4">
              {recordForm.fields.map((field) => (
                <RecordFieldShell key={field.id} field={field}>
                  {renderRecordField(field)}
                </RecordFieldShell>
              ))}
            </div>
            <Button type="submit" className="w-full sm:w-auto">
              {recordForm.id ? "Atualizar ficha" : "Salvar ficha preenchida"}
            </Button>
          </form>
        ) : (
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <h3 className="text-lg font-black text-ink">Ficha pronta para aplicar</h3>
            <p className="mt-1 text-sm leading-6 text-muted">
              Escolha um modelo à esquerda e clique em aplicar para preencher uma ficha vinculada a {client.name}.
            </p>
            <Button className="mt-3 w-full sm:w-auto" onClick={() => applyTemplate()}>
              Aplicar {selectedTemplate?.name || "modelo"}
            </Button>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-black text-ink">Fichas salvas</h3>
            <Button variant="secondary" size="sm" onClick={toggleHistory}>
              {showHistory ? "Ocultar histórico" : "Histórico de alterações"}
            </Button>
          </div>

          {showHistory ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              {fichaHistory.length ? (
                <ul className="space-y-2">
                  {fichaHistory.map((entry) => (
                    <li key={entry.id} className="text-sm font-bold text-ink">
                      {formatDateTime(entry.createdAt)} · editado por {entry.editedBy}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm font-semibold text-muted">Nenhuma alteração registrada ainda.</p>
              )}
            </div>
          ) : null}

          {care.forms.length ? (
            care.forms.map((record) => (
              <article key={record.id} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                  <div className="min-w-0">
                    <p className="text-base font-black text-ink">{record.title || record.templateName}</p>
                    <p className="mt-1 text-xs font-bold text-muted">
                      {record.fields.length} campo(s) · Atualizada em {formatDateTime(record.updatedAt)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <Button variant="secondary" size="sm" onClick={() => editRecord(record)}>
                      Editar
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => duplicateRecord(record.id)}>
                      Duplicar
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => setPendingFormDelete(record)}>
                      Excluir
                    </Button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <EmptyState title="Nenhuma ficha preenchida" description="Aplique um modelo para registrar a primeira ficha personalizada." />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingTemplateDelete)}
        title="Excluir modelo?"
        description={pendingTemplateDelete ? `${pendingTemplateDelete.name} será removido dos modelos reutilizáveis.` : ""}
        confirmLabel="Excluir"
        danger
        onConfirm={confirmDeleteTemplate}
        onCancel={() => setPendingTemplateDelete(null)}
      />

      <ConfirmDialog
        open={Boolean(pendingFormDelete)}
        title="Excluir ficha?"
        description={pendingFormDelete ? `${pendingFormDelete.title || pendingFormDelete.templateName} será removida do prontuário.` : ""}
        confirmLabel="Excluir"
        danger
        onConfirm={confirmDeleteRecord}
        onCancel={() => setPendingFormDelete(null)}
      />
    </div>
  );
}
