import { useEffect, useMemo, useRef, useState } from "react";
import Button from "../Button.jsx";
import ConfirmDialog from "../ConfirmDialog.jsx";
import EmptyState from "../EmptyState.jsx";
import Field, { inputClass } from "../Field.jsx";
import Message from "../Message.jsx";
import {
  createClientDocument,
  deleteClientDocument,
  signClientDocument,
  updateClientDocument
} from "../../services/clientCare.js";
import {
  exportSignedDocument,
  printSignedDocument as printSignedDocumentFile
} from "../../services/signedDocumentExport.js";
import SignaturePad from "./SignaturePad.jsx";
import SignedDocumentPreview from "./SignedDocumentPreview.jsx";

const emptyDocumentForm = { title: "", content: "" };

function responsibilityTermContent(client) {
  return [
    `Eu, ${client.name}, declaro que informei corretamente minhas condições de saúde, alergias, medicamentos em uso e restrições relevantes.`,
    "",
    "Autorizo a realização do atendimento conforme as orientações recebidas e estou ciente dos cuidados necessários antes e depois do procedimento.",
    "",
    "Declaro que as informações fornecidas são verdadeiras e assumo a responsabilidade por comunicar qualquer alteração relevante antes de novos atendimentos.",
    "",
    "Assinatura do cliente:"
  ].join("\n");
}

function legacyResponsibilityTermContents(client) {
  return [
    [
      `Eu ${client.name}, declaro que informei corretamente minhas condições de saúde, alergias, uso de medicamentos e restrições relevantes.`,
      "",
      "Autorizo a realização do atendimento conforme orientações recebidas e estou ciente dos cuidados necessários antes e depois do procedimento.",
      "",
      "Assinatura do cliente:"
    ].join("\n"),
    [
      `Eu, ${client.name}, declaro que informei corretamente minhas condições de saúde, alergias, uso de medicamentos e restrições relevantes.`,
      "",
      "Autorizo a realização do atendimento conforme orientações recebidas e estou ciente dos cuidados necessários antes e depois do procedimento.",
      "",
      "Assinatura do cliente:"
    ].join("\n")
  ];
}

function normalizeDocumentForUse(document, client) {
  const normalizedTitle = String(document.title || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (!normalizedTitle.includes("termo") || !normalizedTitle.includes("responsabilidade")) {
    return document;
  }

  const content = String(document.content || "").trim();
  const shouldUpdate = legacyResponsibilityTermContents(client).some((legacy) => legacy.trim() === content);
  return shouldUpdate ? { ...document, content: responsibilityTermContent(client) } : document;
}

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

function documentTemplate(client, care, type) {
  if (type === "anamnesis") {
    return {
      title: "Ficha preenchida",
      content: [
        `Cliente: ${client.name}`,
        `Telefone: ${client.phone || "-"}`,
        "",
        `Observações gerais: ${care.anamnesis.generalNotes || "-"}`,
        `Alergias: ${care.anamnesis.allergies || "-"}`,
        `Condições da pele: ${care.anamnesis.skinConditions || "-"}`,
        `Produtos utilizados: ${care.anamnesis.productsUsed || "-"}`,
        `Notas livres: ${care.anamnesis.freeNotes || "-"}`
      ].join("\n")
    };
  }

  return {
    title: "Termo de responsabilidade",
    content: responsibilityTermContent(client)
  };
}

function hasLegacyAnamnesis(care) {
  const anamnesis = care.anamnesis || {};
  return Boolean(
    anamnesis.updatedAt ||
      anamnesis.generalNotes ||
      anamnesis.allergies ||
      anamnesis.skinConditions ||
      anamnesis.productsUsed ||
      anamnesis.freeNotes
  );
}

function fieldValueForDocument(field, value) {
  if (field.type === "signature") return value ? "[Assinatura digital salva na ficha]" : "-";
  if (field.type === "image") return value ? "[Imagem anexada na ficha]" : "-";
  if (field.type === "checkbox") return value ? "Sim" : "Não";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "-";
  return value === undefined || value === null || String(value).trim() === "" ? "-" : String(value);
}

function savedFormDocumentTemplate(client, record) {
  const fields = record.fields || [];
  const values = record.values || {};
  const title = cleanGeneratedDocumentTitle(record.title || record.templateName || "Ficha do cliente");

  return {
    title,
    content: [
      `Cliente: ${client.name}`,
      `Telefone: ${client.phone || "-"}`,
      `Ficha: ${record.title || record.templateName || "-"}`,
      record.templateName ? `Modelo: ${record.templateName}` : "",
      record.createdAt ? `Criada em: ${formatDateTime(record.createdAt)}` : "",
      record.updatedAt ? `Atualizada em: ${formatDateTime(record.updatedAt)}` : "",
      "",
      "Campos preenchidos:",
      "",
      ...fields.map((field) => `${field.label}: ${fieldValueForDocument(field, values[field.id])}`)
    ]
      .filter((line) => line !== "")
      .join("\n")
  };
}

function cleanGeneratedDocumentTitle(title) {
  return String(title || "")
    .replace(/^Ficha preenchida\s*-\s*/i, "")
    .trim() || "Documento";
}

function documentForDisplay(document) {
  return { ...document, title: cleanGeneratedDocumentTitle(document.title) };
}

function DocumentStatusBadge({ signed }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${
        signed
          ? "bg-emerald-50 text-success ring-emerald-100"
          : "bg-amber-50 text-amber-700 ring-amber-100"
      }`}
    >
      {signed ? "Assinado" : "Pendente"}
    </span>
  );
}

function DocumentActionButton({ children, icon, tone = "secondary", disabled, onClick }) {
  const styles = {
    primary: "border-brand/20 bg-blue-50 text-brand hover:border-brand/40 hover:bg-blue-100",
    secondary: "border-[#E2E8F0] bg-white text-ink hover:border-blue-200 hover:bg-blue-50 hover:text-brand",
    danger: "border-red-200 bg-red-50 text-danger hover:border-red-300 hover:bg-red-100"
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-3 text-xs font-black shadow-sm transition sm:text-[13px] disabled:cursor-not-allowed disabled:opacity-50 ${styles[tone]}`}
    >
      <span aria-hidden="true">{icon}</span>
      {children}
    </button>
  );
}

export default function DocumentsTab({ client, care, onCareChange, showToast }) {
  const [form, setForm] = useState(emptyDocumentForm);
  const [editingId, setEditingId] = useState("");
  const [signatureTarget, setSignatureTarget] = useState("");
  const [previewDocument, setPreviewDocument] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [formPickerOpen, setFormPickerOpen] = useState(false);
  const [documentSearch, setDocumentSearch] = useState("");
  const [documentStatusFilter, setDocumentStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [operationLoading, setOperationLoading] = useState(false);
  const printingRef = useRef(false);

  useEffect(() => {
    setForm(emptyDocumentForm);
    setEditingId("");
    setSignatureTarget("");
    setPreviewDocument(null);
    setPendingDelete(null);
    setFormPickerOpen(false);
    setDocumentSearch("");
    setDocumentStatusFilter("");
    setError("");
    setOperationLoading(false);
  }, [client.id]);

  const filteredDocuments = useMemo(() => {
    const search = documentSearch.trim().toLowerCase();

    return care.documents
      .map((document) => normalizeDocumentForUse(document, client))
      .map(documentForDisplay)
      .filter((document) => {
        if (!search) return true;
        return String(document.title || "").toLowerCase().includes(search);
      })
      .filter((document) => {
        if (documentStatusFilter === "signed") return Boolean(document.signatureImage);
        if (documentStatusFilter === "pending") return !document.signatureImage;
        return true;
      });
  }, [care.documents, client, documentSearch, documentStatusFilter]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function useTemplate(type) {
    setForm(documentTemplate(client, care, type));
    setEditingId("");
    setFormPickerOpen(false);
  }

  function openFormPicker() {
    if (!care.forms.length && !hasLegacyAnamnesis(care)) {
      showToast("Este cliente ainda não tem ficha salva.", "error");
      return;
    }

    setFormPickerOpen((current) => !current);
  }

  function useSavedForm(record) {
    setForm(savedFormDocumentTemplate(client, record));
    setEditingId("");
    setFormPickerOpen(false);
    showToast("Ficha selecionada para o documento.");
  }

  function resetForm() {
    setForm(emptyDocumentForm);
    setEditingId("");
  }

  function editDocument(document) {
    const safeDocument = normalizeDocumentForUse(document, client);
    setForm({ title: safeDocument.title, content: safeDocument.content });
    setEditingId(document.id);
    setSignatureTarget("");
  }

  function handleSubmit(event) {
    event.preventDefault();
    setOperationLoading(true);
    setError("");

    try {
      const nextCare = editingId
        ? updateClientDocument(client.id, editingId, form)
        : createClientDocument(client.id, form);
      onCareChange(nextCare);
      showToast(editingId ? "Documento atualizado." : "Documento salvo.");
      resetForm();
    } catch (err) {
      setError(err.message || "Nao foi possivel salvar o documento.");
      showToast(err.message || "Nao foi possivel salvar o documento.", "error");
    } finally {
      setOperationLoading(false);
    }
  }

  function handleSignature(documentId, signatureImage) {
    setOperationLoading(true);
    setError("");

    try {
      const nextCare = signClientDocument(client.id, documentId, signatureImage);
      onCareChange(nextCare);
      showToast("Assinatura vinculada ao documento.");
      setSignatureTarget("");
    } catch (err) {
      setError(err.message || "Nao foi possivel salvar a assinatura.");
      showToast(err.message || "Nao foi possivel salvar a assinatura.", "error");
    } finally {
      setOperationLoading(false);
    }
  }

  function handleExport(document) {
    setError("");
    try {
      const filename = exportSignedDocument({ client, document: normalizeDocumentForUse(document, client) });
      showToast(`Documento ${filename} exportado.`);
    } catch (err) {
      setError(err.message || "Nao foi possivel exportar o documento.");
      showToast(err.message, "error");
    }
  }

  function ensureSigned(document) {
    if (document.signatureImage) return true;
    showToast("Assine o documento antes de continuar.", "error");
    return false;
  }

  function previewSignedDocument(document) {
    setPreviewDocument(normalizeDocumentForUse(document, client));
  }

  function printSignedDocument(document) {
    if (!ensureSigned(document)) return;
    if (printingRef.current) return;
    printingRef.current = true;
    setError("");

    try {
      printSignedDocumentFile({ client, document: normalizeDocumentForUse(document, client) });
    } catch (err) {
      setError(err.message || "Nao foi possivel imprimir o documento.");
      showToast(err.message, "error");
    } finally {
      window.setTimeout(() => {
        printingRef.current = false;
      }, 800);
    }
  }

  function requestDelete(document) {
    setPendingDelete(document);
  }

  function confirmDeleteDocument() {
    if (!pendingDelete) return;
    setOperationLoading(true);
    setError("");

    try {
      const nextCare = deleteClientDocument(client.id, pendingDelete.id);
      onCareChange(nextCare);
      showToast("Documento excluido.");

      if (editingId === pendingDelete.id) resetForm();
      if (signatureTarget === pendingDelete.id) setSignatureTarget("");
      if (previewDocument?.id === pendingDelete.id) setPreviewDocument(null);
      setPendingDelete(null);
    } catch (err) {
      setError(err.message || "Nao foi possivel excluir o documento.");
      showToast(err.message || "Nao foi possivel excluir o documento.", "error");
    } finally {
      setOperationLoading(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(300px,42fr)_minmax(500px,58fr)] xl:items-start">
      <div className="xl:col-span-2">
        {operationLoading ? <Message>Salvando alteracoes...</Message> : null}
        <Message type="error" actionLabel="Tentar novamente" onAction={() => setError("")}>
          {error}
        </Message>
      </div>
      <form onSubmit={handleSubmit} className="min-w-0 space-y-4">
        <div>
          <h3 className="text-lg font-black text-ink">{editingId ? "Editar documento" : "Novo documento"}</h3>
          <p className="mt-1 text-sm leading-6 text-muted">Crie termos, fichas preenchidas ou orientações do atendimento.</p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button variant="secondary" onClick={() => useTemplate("term")}>
            Termo modelo
          </Button>
          <Button variant="secondary" onClick={openFormPicker}>
            Usar ficha
          </Button>
        </div>

        {formPickerOpen ? (
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-black text-ink">Selecione a ficha do cliente</p>
                <p className="mt-1 text-xs font-bold text-muted">
                  Escolha uma ficha salva de {client.name} para gerar o texto do documento.
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setFormPickerOpen(false)}>
                Fechar
              </Button>
            </div>

            <div className="mt-3 grid gap-2">
              {care.forms.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => useSavedForm(record)}
                  className="rounded-xl border border-[#E2E8F0] bg-white p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-soft active:translate-y-0"
                >
                  <span className="block text-sm font-black text-ink">
                    {record.title || record.templateName || "Ficha preenchida"}
                  </span>
                  <span className="mt-1 block text-xs font-bold text-muted">
                    {record.fields?.length || 0} campo(s) · Atualizada em {formatDateTime(record.updatedAt || record.createdAt)}
                  </span>
                </button>
              ))}

              {hasLegacyAnamnesis(care) ? (
                <button
                  type="button"
                  onClick={() => useTemplate("anamnesis")}
                  className="rounded-xl border border-[#E2E8F0] bg-white p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-soft active:translate-y-0"
                >
                  <span className="block text-sm font-black text-ink">Anamnese clássica</span>
                  <span className="mt-1 block text-xs font-bold text-muted">
                    Dados da ficha antiga preservada neste cliente.
                  </span>
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <Field label="Título">
          <input
            required
            minLength={2}
            value={form.title}
            onChange={(event) => update("title", event.target.value)}
            className={inputClass}
            placeholder="Termo de responsabilidade"
          />
        </Field>
        <Field label="Texto">
          <textarea
            required
            minLength={2}
            value={form.content}
            onChange={(event) => update("content", event.target.value)}
            className={`${inputClass} min-h-48 resize-none lg:min-h-56`}
            placeholder="Escreva o documento do cliente"
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          {editingId ? (
            <Button variant="secondary" onClick={resetForm}>
              Cancelar
            </Button>
          ) : null}
          <Button type="submit" className={editingId ? "" : "col-span-2"}>
            {editingId ? "Atualizar" : "Salvar documento"}
          </Button>
        </div>
      </form>

      <div className="min-w-0 space-y-4">
        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-black text-ink">Documentos do cliente</h3>
            <p className="mt-1 text-sm leading-6 text-muted">
              {filteredDocuments.length} de {care.documents.length} documento(s)
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px]">
            <input
              type="search"
              value={documentSearch}
              onChange={(event) => setDocumentSearch(event.target.value)}
              className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm font-bold text-ink shadow-sm transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-brand/10"
              placeholder="Buscar documento"
            />
            <select
              value={documentStatusFilter}
              onChange={(event) => setDocumentStatusFilter(event.target.value)}
              className="w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm font-bold text-ink shadow-sm transition focus:border-brand focus:ring-4 focus:ring-brand/10"
            >
              <option value="">Todos</option>
              <option value="signed">Assinados</option>
              <option value="pending">Pendentes</option>
            </select>
          </div>
        </div>

        {care.documents.length ? (
          filteredDocuments.length ? (
            <div className="compact-scroll-list space-y-3 pr-0 sm:space-y-4 sm:pr-1">
              {filteredDocuments.map((document) => {
                const signed = Boolean(document.signatureImage);
                const title = document.title?.trim() || "Documento do cliente";

                return (
                  <article
                    key={document.id}
                    className="min-w-0 rounded-[14px] border border-[#E2E8F0] bg-white p-4 shadow-[0_14px_30px_rgba(15,23,42,0.06)] transition duration-200 hover:border-blue-100 hover:bg-[#F9FAFB] hover:shadow-soft sm:p-5"
                  >
                    <div className="grid gap-3 sm:gap-4 xl:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-3">
                          <div className="min-w-0">
                            <h4 className="line-clamp-2 text-base font-black leading-6 text-ink sm:text-lg" title={title}>
                              {title}
                            </h4>
                            <div className="mt-2 grid gap-1 text-xs font-bold leading-5 text-muted sm:text-sm sm:leading-6">
                              <span>Criado em {formatDateTime(document.createdAt)}</span>
                              {signed && document.signedAt ? (
                                <span>Assinado em {formatDateTime(document.signedAt)}</span>
                              ) : null}
                            </div>
                          </div>
                          <div className="self-start sm:justify-self-end">
                            <DocumentStatusBadge signed={signed} />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <DocumentActionButton icon="👁️" tone="primary" onClick={() => previewSignedDocument(document)}>
                          Visualizar
                        </DocumentActionButton>
                        <DocumentActionButton icon="✍️" onClick={() => setSignatureTarget(signatureTarget === document.id ? "" : document.id)}>
                          Assinar
                        </DocumentActionButton>
                        <DocumentActionButton icon="✏️" onClick={() => editDocument(document)}>
                          Editar
                        </DocumentActionButton>
                        <DocumentActionButton icon="🖨️" disabled={!signed} onClick={() => printSignedDocument(document)}>
                          Imprimir
                        </DocumentActionButton>
                        <DocumentActionButton icon="⬇️" disabled={!signed} onClick={() => handleExport(document)}>
                          Exportar
                        </DocumentActionButton>
                        <DocumentActionButton icon="🗑️" tone="danger" onClick={() => requestDelete(document)}>
                          Excluir
                        </DocumentActionButton>
                      </div>
                    </div>

                    {signatureTarget === document.id ? (
                      <section className="mt-5 border-t border-[#E2E8F0] pt-4">
                        <div className="rounded-xl border border-[#E2E8F0] bg-[#F3F4F6] p-3">
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted">Assinatura do cliente</p>
                          <div className="mt-3">
                            <SignaturePad
                              existingImage={document.signatureImage}
                              onSave={(signatureImage) => handleSignature(document.id, signatureImage)}
                            />
                          </div>
                        </div>
                      </section>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState title="Nenhum documento encontrado" description="Ajuste a busca ou o filtro de status." />
          )
        ) : (
          <EmptyState title="Nenhum documento" description="Crie um termo, uma orientação ou uma cópia da ficha preenchida." />
        )}
      </div>

      {previewDocument ? (
        <div className="agensync-overlay z-50 flex items-end overflow-y-auto bg-ink/45 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
          <div className="max-h-[92vh] w-full overflow-auto rounded-xl bg-white shadow-panel sm:max-w-4xl">
            <div className="no-print flex flex-col gap-3 border-b border-[#E2E8F0] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black text-ink">Documento completo</p>
                <p className="text-sm text-muted">Visualização integral do conteúdo, dados do cliente e assinatura.</p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button variant="secondary" className="w-full" onClick={() => printSignedDocument(previewDocument)}>
                  Imprimir documento
                </Button>
                <Button variant="secondary" className="w-full" onClick={() => setPreviewDocument(null)}>
                  Fechar
                </Button>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              <SignedDocumentPreview client={client} document={previewDocument} />
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Excluir documento?"
        description={
          pendingDelete
            ? `${pendingDelete.title} será removido do histórico do cliente${pendingDelete.signatureImage ? ", junto com a assinatura vinculada" : ""}.`
            : ""
        }
        confirmLabel="Excluir"
        danger
        onConfirm={confirmDeleteDocument}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
