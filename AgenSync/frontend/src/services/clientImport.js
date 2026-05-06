const simpleAgendaColumns = {
  "nome do cliente": "name",
  "contatos": "phone",
  "observacao do cliente": "notes",
  "cpf": "cpf",
  "cnpj": "cnpj",
  "rg": "rg",
  "data nascimento": "birthDate",
  "cep": "zipCode",
  "endereco": "address",
  "numero": "addressNumber",
  "complemento": "addressComplement",
  "bairro": "district",
  "estado": "state",
  "cidade": "city",
  "tags": "tags",
  "como conheceu": "source",
  "codcliente": "externalId"
};

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ");
}

function cleanText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

export function normalizeDigits(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits || null;
}

export function normalizeImportPhone(value) {
  const digits = normalizeDigits(String(value || "").split(/[,;/|]/)[0]);
  return digits || "";
}

function normalizeDocument(value) {
  return normalizeDigits(value) || "";
}

function normalizeBrazilianDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  if (!text) return null;

  const brazilian = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (brazilian) {
    const day = brazilian[1].padStart(2, "0");
    const month = brazilian[2].padStart(2, "0");
    const fullYear = brazilian[3].length === 2 ? `20${brazilian[3]}` : brazilian[3];
    return `${fullYear}-${month}-${day}`;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function isEmptyRow(row) {
  return Object.values(row || {}).every((value) => !String(value ?? "").trim());
}

export function normalizeImportedClient(rawRow, lineNumber = 0) {
  const row = {};

  Object.entries(rawRow || {}).forEach(([column, value]) => {
    const field = simpleAgendaColumns[normalizeHeader(column)];
    if (field) row[field] = value;
  });

  const client = {
    name: cleanText(row.name) || "",
    phone: normalizeImportPhone(row.phone),
    notes: cleanText(row.notes) || "",
    cpf: normalizeDocument(row.cpf),
    cnpj: normalizeDocument(row.cnpj),
    rg: cleanText(row.rg) || "",
    birthDate: normalizeBrazilianDate(row.birthDate),
    zipCode: normalizeDocument(row.zipCode),
    address: cleanText(row.address) || "",
    addressNumber: cleanText(row.addressNumber) || "",
    addressComplement: cleanText(row.addressComplement) || "",
    district: cleanText(row.district) || "",
    state: cleanText(row.state)?.toUpperCase() || "",
    city: cleanText(row.city) || "",
    tags: cleanText(row.tags) || "",
    source: cleanText(row.source) || "",
    externalId: cleanText(row.externalId) || ""
  };

  const errors = [];
  if (!client.name || client.name.length < 2) errors.push("Nome do Cliente e obrigatorio.");

  return {
    lineNumber,
    client,
    errors,
    status: errors.length ? "erro" : "pronto"
  };
}

export async function parseSimpleAgendaClientsFile(file) {
  if (!file) throw new Error("Selecione uma planilha para importar.");

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!["csv", "xlsx", "xls"].includes(extension || "")) {
    throw new Error("Arquivo invalido. Use CSV, XLS ou XLSX.");
  }

  const buffer = await file.arrayBuffer();
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("A planilha esta vazia.");

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  const nonEmptyRows = rows.filter((row) => !isEmptyRow(row));
  const headers = Object.keys(nonEmptyRows[0] || {});
  const normalizedHeaders = new Set(headers.map(normalizeHeader));
  const recognizedColumns = headers.filter((header) => simpleAgendaColumns[normalizeHeader(header)]);
  const requiredColumns = ["nome do cliente", "contatos"];
  const looksLikeSimpleAgenda = requiredColumns.every((column) => normalizedHeaders.has(column));

  if (!nonEmptyRows.length) {
    throw new Error("Nenhum cliente encontrado na planilha.");
  }

  if (!looksLikeSimpleAgenda) {
    throw new Error("Nao reconheci o modelo do Simples Agenda. Confira se existe a coluna Nome do Cliente.");
  }

  return {
    rows: nonEmptyRows.map((row, index) => normalizeImportedClient(row, index + 2)),
    recognizedColumns,
    totalRows: nonEmptyRows.length
  };
}

export function detectDuplicateClients(importRows, existingClients = []) {
  const existingKeys = new Set(
    existingClients.flatMap((client) => [
      client.phone ? `phone:${normalizeImportPhone(client.phone)}` : "",
      client.cpf ? `cpf:${normalizeDocument(client.cpf)}` : "",
      client.phone ? `name_phone:${String(client.name || "").trim().toLowerCase()}_${normalizeImportPhone(client.phone)}` : ""
    ].filter(Boolean))
  );
  const seenKeys = new Set();

  return importRows.map((row) => {
    if (row.errors.length) return row;

    const client = row.client;
    const keys = [
      client.phone ? `phone:${client.phone}` : "",
      client.cpf ? `cpf:${client.cpf}` : "",
      client.phone ? `name_phone:${client.name.trim().toLowerCase()}_${client.phone}` : ""
    ].filter(Boolean);
    const isDuplicate = keys.some((key) => existingKeys.has(key) || seenKeys.has(key));
    keys.forEach((key) => seenKeys.add(key));

    return {
      ...row,
      status: isDuplicate ? "duplicado" : "pronto"
    };
  });
}
