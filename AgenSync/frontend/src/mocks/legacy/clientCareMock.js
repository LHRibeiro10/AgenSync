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

function readCareDb() {
  const raw = localStorage.getItem(CLIENT_CARE_KEY);
  if (!raw) return {};

  try {
    const data = JSON.parse(raw);
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

function writeCareDb(data) {
  localStorage.setItem(CLIENT_CARE_KEY, JSON.stringify(data));
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
    documents: Array.isArray(care.documents) ? care.documents : [],
    budgets: Array.isArray(care.budgets) ? care.budgets : [],
    forms: Array.isArray(care.forms) ? care.forms : [],
    photos: Array.isArray(care.photos) ? care.photos : [],
    evolutions: Array.isArray(care.evolutions) ? care.evolutions : []
  };
}

function withClientCare(clientId, updater) {
  const db = readCareDb();
  const current = normalizeCare(db[clientId] || defaultCare());
  const next = normalizeCare(updater(current));
  db[clientId] = next;
  writeCareDb(db);
  return next;
}

function text(value) {
  return String(value || "").trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
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

const defaultTemplates = [
  {
    id: "template_facial",
    name: "Ficha de anamnese facial",
    description: "Avaliação inicial para estética facial, alergias, pele e autorização.",
    fields: [
      { id: "facial_goal", label: "Objetivo do atendimento", type: "longText", required: true },
      { id: "facial_allergies", label: "Alergias conhecidas", type: "longText" },
      { id: "facial_skin", label: "Tipo de pele", type: "singleSelect", options: ["Oleosa", "Seca", "Mista", "Sensível"] },
      { id: "facial_products", label: "Produtos em uso", type: "multiSelect", options: ["Ácidos", "Retinol", "Clareadores", "Home care"] },
      { id: "facial_pregnant", label: "Gestante ou lactante", type: "checkbox" },
      { id: "facial_signature", label: "Assinatura do cliente", type: "signature", required: true }
    ]
  },
  {
    id: "template_body",
    name: "Ficha de avaliação corporal",
    description: "Medidas, queixas, hábitos e registro fotográfico.",
    fields: [
      { id: "body_weight", label: "Peso atual", type: "number" },
      { id: "body_goal", label: "Objetivo principal", type: "shortText", required: true },
      { id: "body_habits", label: "Hábitos relevantes", type: "longText" },
      { id: "body_date", label: "Data da avaliação", type: "date" },
      { id: "body_photo", label: "Foto de avaliação", type: "image" }
    ]
  },
  {
    id: "template_followup",
    name: "Ficha de acompanhamento",
    description: "Evolução pós-procedimento e observações de retorno.",
    fields: [
      { id: "followup_date", label: "Data do retorno", type: "date", required: true },
      { id: "followup_evolution", label: "Evolução observada", type: "longText", required: true },
      { id: "followup_reactions", label: "Reações relatadas", type: "multiSelect", options: ["Vermelhidão", "Sensibilidade", "Dor", "Sem intercorrências"] },
      { id: "followup_orientation", label: "Orientações passadas", type: "longText" },
      { id: "followup_signature", label: "Assinatura do cliente", type: "signature" }
    ]
  }
].map((template) =>
  normalizeTemplate({
    ...template,
    createdAt: "2026-04-14T09:00:00.000Z",
    updatedAt: "2026-04-14T09:00:00.000Z"
  })
);

function listTemplatesFromDb(db) {
  const stored = ensureArray(db[TEMPLATE_BUCKET]).map(normalizeTemplate);
  if (stored.length) return stored;
  db[TEMPLATE_BUCKET] = defaultTemplates;
  writeCareDb(db);
  return defaultTemplates;
}

function validateTemplatePayload(payload) {
  const template = normalizeTemplate(payload);
  if (template.name.length < 2) throw new Error("Nome do modelo é obrigatório.");
  if (!template.fields.length) throw new Error("Adicione pelo menos um campo ao modelo.");
  template.fields.forEach((field) => {
    if (["singleSelect", "multiSelect"].includes(field.type) && !field.options.length) {
      throw new Error(`Informe opções para o campo "${field.label}".`);
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
  if (title.length < 2) throw new Error("Título da evolução é obrigatório.");
  if (notes.length < 2) throw new Error("Descrição da evolução é obrigatória.");
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
  if (!payload.image) throw new Error("Imagem obrigatória.");
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

export function saveClientAnamnesis(clientId, payload) {
  return withClientCare(clientId, (care) => ({
    ...care,
    anamnesis: {
      generalNotes: text(payload.generalNotes),
      allergies: text(payload.allergies),
      skinConditions: text(payload.skinConditions),
      productsUsed: text(payload.productsUsed),
      freeNotes: text(payload.freeNotes),
      updatedAt: now()
    }
  }));
}

export function createClientDocument(clientId, payload) {
  const title = text(payload.title);
  const content = text(payload.content);
  if (title.length < 2) throw new Error("Título do documento é obrigatório.");
  if (content.length < 2) throw new Error("Texto do documento é obrigatório.");

  return withClientCare(clientId, (care) => {
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
  });
}

export function updateClientDocument(clientId, documentId, payload) {
  const title = text(payload.title);
  const content = text(payload.content);
  if (title.length < 2) throw new Error("Título do documento é obrigatório.");
  if (content.length < 2) throw new Error("Texto do documento é obrigatório.");

  return withClientCare(clientId, (care) => ({
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
  }));
}

export function deleteClientDocument(clientId, documentId) {
  return withClientCare(clientId, (care) => ({
    ...care,
    documents: care.documents.filter((document) => document.id !== documentId)
  }));
}

export function signClientDocument(clientId, documentId, signatureImage) {
  if (!signatureImage) throw new Error("Assinatura vazia.");

  return withClientCare(clientId, (care) => ({
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
  }));
}

export function createClientBudget(clientId, payload) {
  const services = (payload.services || []).map(normalizeServiceLine).filter((item) => item.name);
  const products = (payload.products || []).map(normalizeProductLine).filter((item) => item.name);
  const notes = text(payload.notes);
  if (!services.length && !products.length) {
    throw new Error("Adicione pelo menos um serviço ou produto ao orçamento.");
  }

  return withClientCare(clientId, (care) => {
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
  });
}

export function signClientBudget(clientId, budgetId, signatureImage) {
  if (!signatureImage) throw new Error("Assinatura vazia.");

  return withClientCare(clientId, (care) => ({
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
  }));
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
  if (!existing) throw new Error("Modelo não encontrado.");
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
  if (!source) throw new Error("Modelo não encontrado.");
  const createdAt = now();
  const copy = normalizeTemplate({
    ...source,
    id: id("template"),
    name: `${source.name} cópia`,
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

  return withClientCare(clientId, (care) => {
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
  });
}

export function duplicateClientForm(clientId, formId) {
  return withClientCare(clientId, (care) => {
    const source = care.forms.find((form) => form.id === formId);
    if (!source) throw new Error("Ficha não encontrada.");
    const createdAt = now();
    return {
      ...care,
      forms: [
        {
          ...source,
          id: id("form"),
          title: `${source.title || source.templateName} cópia`,
          createdAt,
          updatedAt: createdAt
        },
        ...care.forms
      ]
    };
  });
}

export function deleteClientForm(clientId, formId) {
  return withClientCare(clientId, (care) => ({
    ...care,
    forms: care.forms.filter((form) => form.id !== formId),
    photos: care.photos.map((photo) => (photo.linkedFormId === formId ? { ...photo, linkedFormId: "", updatedAt: now() } : photo))
  }));
}

export function createClientEvolution(clientId, payload) {
  return withClientCare(clientId, (care) => ({
    ...care,
    evolutions: [normalizeEvolution(payload), ...care.evolutions]
  }));
}

export function updateClientEvolution(clientId, evolutionId, payload) {
  return withClientCare(clientId, (care) => ({
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
  }));
}

export function deleteClientEvolution(clientId, evolutionId) {
  return withClientCare(clientId, (care) => ({
    ...care,
    evolutions: care.evolutions.filter((evolution) => evolution.id !== evolutionId)
  }));
}

export function addClientPhotos(clientId, photos) {
  const normalized = ensureArray(photos).map(normalizePhoto);
  if (!normalized.length) throw new Error("Adicione pelo menos uma foto.");

  return withClientCare(clientId, (care) => ({
    ...care,
    photos: [...normalized, ...care.photos]
  }));
}

export function updateClientPhoto(clientId, photoId, payload) {
  return withClientCare(clientId, (care) => ({
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
  }));
}

export function deleteClientPhoto(clientId, photoId) {
  return withClientCare(clientId, (care) => ({
    ...care,
    photos: care.photos.filter((photo) => photo.id !== photoId)
  }));
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
      summary: `${appointment.client?.name || "Cliente"} · ${appointment.startTime} até ${appointment.endTime}`,
      tab: "history"
    });
  });

  safeCare.forms.forEach((form) => {
    items.push({
      id: `form_${form.id}`,
      date: timelineDate(form.updatedAt || form.createdAt),
      type: form.updatedAt && form.updatedAt !== form.createdAt ? "Ficha editada" : "Ficha criada",
      title: form.title || form.templateName,
      summary: `${form.fields.length} campo(s) preenchidos no prontuário.`,
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
      type: "Orçamento",
      title: `Orçamento de ${budget.date}`,
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
      summary: photo.linkedFormId ? "Imagem vinculada a uma ficha." : "Imagem salva no prontuário.",
      tab: "photos"
    });
  });

  safeCare.evolutions.forEach((evolution) => {
    items.push({
      id: `evolution_${evolution.id}`,
      date: timelineDate(evolution.updatedAt || evolution.createdAt),
      type: "Evolução",
      title: evolution.title,
      summary: evolution.notes,
      tab: "evolution"
    });
  });

  if (safeCare.anamnesis.updatedAt) {
    items.push({
      id: "legacy_anamnesis",
      date: timelineDate(safeCare.anamnesis.updatedAt),
      type: "Anamnese clássica",
      title: "Ficha de anamnese",
      summary: "Registro antigo preservado no prontuário.",
      tab: "forms"
    });
  }

  return items.sort((first, second) => new Date(second.date) - new Date(first.date));
}
