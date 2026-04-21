import { httpClient } from "../api/httpClient.js";

const CLIENT_CARE_KEY = "agensync_client_care_v1";
const TEMPLATE_BUCKET = "__formTemplates";

export const emptyAnamnesis = {
  generalNotes: "",
  allergies: "",
  skinConditions: "",
  productsUsed: "",
  freeNotes: "",
  updatedAt: ""
};

function id(prefix) {
  if (window.crypto?.randomUUID) return `${prefix}_${window.crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function now() {
  return new Date().toISOString();
}

function text(value) {
  return String(value || "").trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function defaultCare() {
  return {
    anamnesis: { ...emptyAnamnesis },
    documents: [],
    budgets: [],
    forms: [],
    photos: [],
    evolutions: []
  };
}

function normalizeCare(care = {}) {
  return {
    anamnesis: { ...emptyAnamnesis, ...(care.anamnesis || {}) },
    documents: ensureArray(care.documents),
    budgets: ensureArray(care.budgets),
    forms: ensureArray(care.forms),
    photos: ensureArray(care.photos),
    evolutions: ensureArray(care.evolutions)
  };
}

function readCareDb() {
  try {
    const data = JSON.parse(localStorage.getItem(CLIENT_CARE_KEY) || "{}");
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

function writeCareDb(data) {
  localStorage.setItem(CLIENT_CARE_KEY, JSON.stringify(data));
}

function cacheClientCare(clientId, care) {
  if (!clientId) return;
  const db = readCareDb();
  db[clientId] = normalizeCare(care);
  writeCareDb(db);
}

function listTemplatesFromDb(db) {
  return ensureArray(db[TEMPLATE_BUCKET]).map(normalizeTemplate);
}

async function saveRemote(clientId, care) {
  if (!clientId) return care;
  const result = await httpClient.put(`/clients/${clientId}/care-record`, { body: care });
  const normalized = normalizeCare(result?.care || care);
  cacheClientCare(clientId, normalized);
  return normalized;
}

function persistAfterLocalChange(clientId, care) {
  saveRemote(clientId, care).catch((error) => {
    console.warn("[AgenSync] Falha ao sincronizar prontuario com backend.", error);
  });
  return care;
}

function withClientCare(clientId, updater) {
  const current = getClientCare(clientId);
  const next = normalizeCare(updater(current));
  cacheClientCare(clientId, next);
  return next;
}

function normalizeField(field = {}) {
  const label = text(field.label);
  return {
    id: field.id || id("field"),
    label,
    type: field.type || "shortText",
    required: Boolean(field.required),
    options: ensureArray(field.options).map(text).filter(Boolean)
  };
}

function normalizeTemplate(template = {}) {
  return {
    id: template.id || id("template"),
    name: text(template.name) || "Modelo sem nome",
    description: text(template.description),
    fields: ensureArray(template.fields).map(normalizeField).filter((field) => field.label),
    createdAt: template.createdAt || now(),
    updatedAt: template.updatedAt || template.createdAt || now()
  };
}

function validateTemplatePayload(payload) {
  const template = normalizeTemplate(payload);
  if (template.name.length < 2) throw new Error("Nome do modelo e obrigatorio.");
  if (!template.fields.length) throw new Error("Adicione pelo menos um campo ao modelo.");
  template.fields.forEach((field) => {
    if (["singleSelect", "multiSelect"].includes(field.type) && !field.options.length) {
      throw new Error(`Informe opcoes para o campo "${field.label}".`);
    }
  });
  return template;
}

function normalizeFormRecord(payload = {}, template = null) {
  const sourceFields = template?.fields || payload.fields || [];
  const createdAt = payload.createdAt || now();
  return {
    id: payload.id || id("form"),
    templateId: payload.templateId || template?.id || "",
    templateName: text(payload.templateName) || template?.name || "Ficha personalizada",
    title: text(payload.title) || template?.name || "Ficha personalizada",
    fields: sourceFields.map(normalizeField).filter((field) => field.label),
    values: payload.values && typeof payload.values === "object" ? payload.values : {},
    createdAt,
    updatedAt: payload.updatedAt || createdAt
  };
}

function normalizeEvolution(payload = {}) {
  const title = text(payload.title);
  const notes = text(payload.notes);
  if (title.length < 2) throw new Error("Titulo da evolucao e obrigatorio.");
  if (notes.length < 2) throw new Error("Descricao da evolucao e obrigatoria.");
  const createdAt = payload.createdAt || now();
  return {
    id: payload.id || id("evolution"),
    date: payload.date || new Date().toISOString().slice(0, 10),
    title,
    notes,
    image: payload.image || "",
    createdAt,
    updatedAt: payload.updatedAt || createdAt
  };
}

function normalizePhoto(payload = {}) {
  if (!payload.image) throw new Error("Imagem obrigatoria.");
  const createdAt = payload.createdAt || now();
  return {
    id: payload.id || id("photo"),
    image: payload.image,
    caption: text(payload.caption),
    linkedFormId: payload.linkedFormId || "",
    createdAt,
    updatedAt: payload.updatedAt || createdAt
  };
}

function normalizeServiceLine(line) {
  const price = Number(line.price ?? line.priceDefault ?? 0);

  return {
    id: line.id || id("budget_service"),
    serviceId: line.serviceId || "",
    name: text(line.name),
    price: Number.isFinite(price) && price >= 0 ? Number(price.toFixed(2)) : 0
  };
}

function normalizeProductLine(line) {
  const quantity = Number(line.quantity || 1);
  const unitPrice = Number(line.unitPrice ?? line.salePrice ?? 0);
  const safeQuantity = Number.isInteger(quantity) && quantity > 0 ? quantity : 1;
  const safeUnitPrice = Number.isFinite(unitPrice) && unitPrice >= 0 ? Number(unitPrice.toFixed(2)) : 0;

  return {
    id: line.id || id("budget_product"),
    productId: line.productId || "",
    name: text(line.name),
    quantity: safeQuantity,
    unitPrice: safeUnitPrice,
    total: Number((safeQuantity * safeUnitPrice).toFixed(2))
  };
}

function budgetTotal(services, products) {
  const servicesTotal = services.reduce((total, item) => total + Number(item.price || 0), 0);
  const productsTotal = products.reduce((total, item) => total + Number(item.total || 0), 0);
  return Number((servicesTotal + productsTotal).toFixed(2));
}

export function getClientCare(clientId) {
  if (!clientId) return defaultCare();
  const db = readCareDb();
  return normalizeCare(db[clientId] || defaultCare());
}

export async function loadClientCare(clientId) {
  if (!clientId) return defaultCare();

  const result = await httpClient.get(`/clients/${clientId}/care-record`);
  const care = normalizeCare(result?.care || {});
  cacheClientCare(clientId, care);
  return care;
}

export function saveClientAnamnesis(clientId, payload) {
  return persistAfterLocalChange(
    clientId,
    withClientCare(clientId, (care) => ({
      ...care,
      anamnesis: {
        generalNotes: text(payload.generalNotes),
        allergies: text(payload.allergies),
        skinConditions: text(payload.skinConditions),
        productsUsed: text(payload.productsUsed),
        freeNotes: text(payload.freeNotes),
        updatedAt: now()
      }
    }))
  );
}

export function createClientDocument(clientId, payload) {
  const title = text(payload.title);
  const content = text(payload.content);
  if (title.length < 2) throw new Error("Titulo do documento e obrigatorio.");
  if (content.length < 2) throw new Error("Texto do documento e obrigatorio.");

  return persistAfterLocalChange(
    clientId,
    withClientCare(clientId, (care) => {
      const createdAt = now();
      return {
        ...care,
        documents: [
          {
            id: id("doc"),
            title,
            content,
            signatureImage: payload.signatureImage || "",
            createdAt,
            updatedAt: createdAt
          },
          ...care.documents
        ]
      };
    })
  );
}

export function updateClientDocument(clientId, documentId, payload) {
  const title = text(payload.title);
  const content = text(payload.content);
  if (title.length < 2) throw new Error("Titulo do documento e obrigatorio.");
  if (content.length < 2) throw new Error("Texto do documento e obrigatorio.");

  return persistAfterLocalChange(
    clientId,
    withClientCare(clientId, (care) => ({
      ...care,
      documents: care.documents.map((document) =>
        document.id === documentId
          ? {
              ...document,
              title,
              content,
              updatedAt: now()
            }
          : document
      )
    }))
  );
}

export function deleteClientDocument(clientId, documentId) {
  return persistAfterLocalChange(
    clientId,
    withClientCare(clientId, (care) => ({
      ...care,
      documents: care.documents.filter((document) => document.id !== documentId)
    }))
  );
}

export function signClientDocument(clientId, documentId, signatureImage) {
  if (!signatureImage) throw new Error("Assinatura vazia.");

  return persistAfterLocalChange(
    clientId,
    withClientCare(clientId, (care) => ({
      ...care,
      documents: care.documents.map((document) =>
        document.id === documentId
          ? {
              ...document,
              signatureImage,
              signedAt: now(),
              updatedAt: now()
            }
          : document
      )
    }))
  );
}

export function createClientBudget(clientId, payload) {
  const services = (payload.services || []).map(normalizeServiceLine).filter((item) => item.name);
  const products = (payload.products || []).map(normalizeProductLine).filter((item) => item.name);
  const notes = text(payload.notes);
  if (!services.length && !products.length) {
    throw new Error("Adicione pelo menos um servico ou produto ao orcamento.");
  }

  return persistAfterLocalChange(
    clientId,
    withClientCare(clientId, (care) => {
      const createdAt = now();
      return {
        ...care,
        budgets: [
          {
            id: id("budget"),
            date: payload.date || new Date().toISOString().slice(0, 10),
            services,
            products,
            notes,
            total: budgetTotal(services, products),
            signatureImage: payload.signatureImage || "",
            createdAt,
            updatedAt: createdAt
          },
          ...care.budgets
        ]
      };
    })
  );
}

export function signClientBudget(clientId, budgetId, signatureImage) {
  if (!signatureImage) throw new Error("Assinatura vazia.");

  return persistAfterLocalChange(
    clientId,
    withClientCare(clientId, (care) => ({
      ...care,
      budgets: care.budgets.map((budget) =>
        budget.id === budgetId
          ? {
              ...budget,
              signatureImage,
              signedAt: now(),
              updatedAt: now()
            }
          : budget
      )
    }))
  );
}

export function listFormTemplates() {
  const db = readCareDb();
  return listTemplatesFromDb(db);
}

export function createFormTemplate(payload) {
  const db = readCareDb();
  const template = validateTemplatePayload({
    ...payload,
    id: id("template"),
    createdAt: now(),
    updatedAt: now()
  });
  const templates = listTemplatesFromDb(db);
  db[TEMPLATE_BUCKET] = [template, ...templates];
  writeCareDb(db);
  return db[TEMPLATE_BUCKET];
}

export function updateFormTemplate(templateId, payload) {
  const db = readCareDb();
  const templates = listTemplatesFromDb(db);
  const existing = templates.find((template) => template.id === templateId);
  if (!existing) throw new Error("Modelo nao encontrado.");
  const updated = validateTemplatePayload({
    ...existing,
    ...payload,
    id: templateId,
    createdAt: existing.createdAt,
    updatedAt: now()
  });
  db[TEMPLATE_BUCKET] = templates.map((template) => (template.id === templateId ? updated : template));
  writeCareDb(db);
  return db[TEMPLATE_BUCKET];
}

export function duplicateFormTemplate(templateId) {
  const db = readCareDb();
  const templates = listTemplatesFromDb(db);
  const source = templates.find((template) => template.id === templateId);
  if (!source) throw new Error("Modelo nao encontrado.");
  const createdAt = now();
  const copy = normalizeTemplate({
    ...source,
    id: id("template"),
    name: `${source.name} copia`,
    fields: source.fields.map((field) => ({ ...field, id: id("field") })),
    createdAt,
    updatedAt: createdAt
  });
  db[TEMPLATE_BUCKET] = [copy, ...templates];
  writeCareDb(db);
  return db[TEMPLATE_BUCKET];
}

export function deleteFormTemplate(templateId) {
  const db = readCareDb();
  const templates = listTemplatesFromDb(db);
  db[TEMPLATE_BUCKET] = templates.filter((template) => template.id !== templateId);
  writeCareDb(db);
  return db[TEMPLATE_BUCKET];
}

export function saveClientForm(clientId, payload) {
  const templates = listFormTemplates();
  const template = templates.find((item) => item.id === payload.templateId);
  const record = normalizeFormRecord(payload, template);
  if (!record.fields.length) throw new Error("Ficha sem campos.");

  return persistAfterLocalChange(
    clientId,
    withClientCare(clientId, (care) => {
      const exists = care.forms.some((form) => form.id === record.id);
      return {
        ...care,
        forms: exists
          ? care.forms.map((form) =>
              form.id === record.id
                ? {
                    ...record,
                    createdAt: form.createdAt,
                    updatedAt: now()
                  }
                : form
            )
          : [
              {
                ...record,
                id: id("form"),
                createdAt: now(),
                updatedAt: now()
              },
              ...care.forms
            ]
      };
    })
  );
}

export function duplicateClientForm(clientId, formId) {
  return persistAfterLocalChange(
    clientId,
    withClientCare(clientId, (care) => {
      const source = care.forms.find((form) => form.id === formId);
      if (!source) throw new Error("Ficha nao encontrada.");
      const createdAt = now();
      return {
        ...care,
        forms: [
          {
            ...source,
            id: id("form"),
            title: `${source.title || source.templateName} copia`,
            createdAt,
            updatedAt: createdAt
          },
          ...care.forms
        ]
      };
    })
  );
}

export function deleteClientForm(clientId, formId) {
  return persistAfterLocalChange(
    clientId,
    withClientCare(clientId, (care) => ({
      ...care,
      forms: care.forms.filter((form) => form.id !== formId),
      photos: care.photos.map((photo) => (photo.linkedFormId === formId ? { ...photo, linkedFormId: "", updatedAt: now() } : photo))
    }))
  );
}

export function createClientEvolution(clientId, payload) {
  return persistAfterLocalChange(
    clientId,
    withClientCare(clientId, (care) => ({
      ...care,
      evolutions: [normalizeEvolution(payload), ...care.evolutions]
    }))
  );
}

export function updateClientEvolution(clientId, evolutionId, payload) {
  return persistAfterLocalChange(
    clientId,
    withClientCare(clientId, (care) => ({
      ...care,
      evolutions: care.evolutions.map((evolution) =>
        evolution.id === evolutionId
          ? normalizeEvolution({
              ...evolution,
              ...payload,
              id: evolutionId,
              createdAt: evolution.createdAt,
              updatedAt: now()
            })
          : evolution
      )
    }))
  );
}

export function deleteClientEvolution(clientId, evolutionId) {
  return persistAfterLocalChange(
    clientId,
    withClientCare(clientId, (care) => ({
      ...care,
      evolutions: care.evolutions.filter((evolution) => evolution.id !== evolutionId)
    }))
  );
}

export function addClientPhotos(clientId, photos) {
  const normalized = ensureArray(photos).map(normalizePhoto);
  if (!normalized.length) throw new Error("Adicione pelo menos uma foto.");

  return persistAfterLocalChange(
    clientId,
    withClientCare(clientId, (care) => ({
      ...care,
      photos: [...normalized, ...care.photos]
    }))
  );
}

export function updateClientPhoto(clientId, photoId, payload) {
  return persistAfterLocalChange(
    clientId,
    withClientCare(clientId, (care) => ({
      ...care,
      photos: care.photos.map((photo) =>
        photo.id === photoId
          ? {
              ...photo,
              caption: payload.caption === undefined ? photo.caption : text(payload.caption),
              linkedFormId: payload.linkedFormId === undefined ? photo.linkedFormId : payload.linkedFormId,
              updatedAt: now()
            }
          : photo
      )
    }))
  );
}

export function deleteClientPhoto(clientId, photoId) {
  return persistAfterLocalChange(
    clientId,
    withClientCare(clientId, (care) => ({
      ...care,
      photos: care.photos.filter((photo) => photo.id !== photoId)
    }))
  );
}

function timelineDate(value) {
  return value || "1970-01-01T00:00:00.000Z";
}

export function buildClientTimeline({ care, appointments = [] }) {
  const items = [];
  const safeCare = normalizeCare(care);

  appointments.forEach((appointment) => {
    items.push({
      id: `appointment_${appointment.id}`,
      date: `${appointment.date}T${appointment.startTime || "00:00"}:00`,
      type: "Atendimento",
      title: appointment.service?.name || "Atendimento",
      summary: `${appointment.client?.name || "Cliente"} - ${appointment.startTime} ate ${appointment.endTime}`,
      tab: "history"
    });
  });

  safeCare.forms.forEach((form) => {
    items.push({
      id: `form_${form.id}`,
      date: timelineDate(form.updatedAt || form.createdAt),
      type: form.updatedAt && form.updatedAt !== form.createdAt ? "Ficha editada" : "Ficha criada",
      title: form.title || form.templateName,
      summary: `${form.fields.length} campo(s) preenchidos no prontuario.`,
      tab: "forms"
    });
  });

  safeCare.documents.forEach((document) => {
    items.push({
      id: `document_${document.id}`,
      date: timelineDate(document.signedAt || document.updatedAt || document.createdAt),
      type: document.signedAt ? "Documento assinado" : "Documento",
      title: document.title,
      summary: document.signedAt ? "Documento com assinatura digital vinculada." : "Documento salvo no cliente.",
      tab: "documents"
    });
  });

  safeCare.budgets.forEach((budget) => {
    items.push({
      id: `budget_${budget.id}`,
      date: timelineDate(budget.signedAt || budget.updatedAt || budget.createdAt),
      type: "Orcamento",
      title: `Orcamento de ${budget.date}`,
      summary: `Total: R$ ${Number(budget.total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      tab: "budgets"
    });
  });

  safeCare.photos.forEach((photo) => {
    items.push({
      id: `photo_${photo.id}`,
      date: timelineDate(photo.updatedAt || photo.createdAt),
      type: "Foto anexada",
      title: photo.caption || "Foto do cliente",
      summary: photo.linkedFormId ? "Imagem vinculada a uma ficha." : "Imagem salva no prontuario.",
      tab: "photos"
    });
  });

  safeCare.evolutions.forEach((evolution) => {
    items.push({
      id: `evolution_${evolution.id}`,
      date: timelineDate(evolution.updatedAt || evolution.createdAt),
      type: "Evolucao",
      title: evolution.title,
      summary: evolution.notes,
      tab: "evolution"
    });
  });

  if (safeCare.anamnesis.updatedAt) {
    items.push({
      id: "legacy_anamnesis",
      date: timelineDate(safeCare.anamnesis.updatedAt),
      type: "Anamnese classica",
      title: "Ficha de anamnese",
      summary: "Registro preservado no prontuario.",
      tab: "forms"
    });
  }

  return items.sort((first, second) => new Date(second.date) - new Date(first.date));
}
