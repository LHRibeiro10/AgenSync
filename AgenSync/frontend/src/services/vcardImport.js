import { normalizeImportPhone } from "./clientImport.js";

function cleanText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

// Unfolds RFC 6350 continuation lines: a line starting with a space or tab
// is a continuation of the previous line.
function unfoldLines(text) {
  const rawLines = String(text || "").split(/\r\n|\r|\n/);
  const lines = [];

  rawLines.forEach((line) => {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  });

  return lines;
}

function parseLine(line) {
  const separatorIndex = line.indexOf(":");
  if (separatorIndex === -1) return null;

  const rawKey = line.slice(0, separatorIndex);
  const value = line.slice(separatorIndex + 1);
  const [name] = rawKey.split(";");
  return { name: name.trim().toUpperCase(), value };
}

function extractName(vcard) {
  const fn = vcard.find((entry) => entry.name === "FN");
  if (fn?.value.trim()) return fn.value.trim();

  const n = vcard.find((entry) => entry.name === "N");
  if (n?.value.trim()) {
    const parts = n.value.split(";").map((part) => part.trim()).filter(Boolean);
    return parts.reverse().join(" ").trim();
  }

  return "";
}

function buildRow(vcard, lineNumber) {
  const name = cleanText(extractName(vcard)) || "";
  const phoneEntry = vcard.find((entry) => entry.name === "TEL");
  const emailEntry = vcard.find((entry) => entry.name === "EMAIL");

  const client = {
    name,
    phone: phoneEntry ? normalizeImportPhone(phoneEntry.value) : "",
    email: emailEntry ? cleanText(emailEntry.value) || "" : "",
    notes: ""
  };

  const errors = [];
  if (!client.name || client.name.length < 2) errors.push("Nome do contato e obrigatorio.");
  if (!client.phone && !client.email) errors.push("Contato sem telefone ou e-mail.");

  return {
    lineNumber,
    client,
    errors,
    status: errors.length ? "erro" : "pronto"
  };
}

export async function parseVCardFile(file) {
  if (!file) throw new Error("Selecione um arquivo .vcf para importar.");

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension !== "vcf") {
    throw new Error("Arquivo invalido. Use um arquivo .vcf exportado dos seus contatos.");
  }

  const text = await file.text();
  const lines = unfoldLines(text);

  const cards = [];
  let currentCard = null;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (/^BEGIN:VCARD$/i.test(trimmed)) {
      currentCard = [];
      return;
    }
    if (/^END:VCARD$/i.test(trimmed)) {
      if (currentCard) cards.push(currentCard);
      currentCard = null;
      return;
    }
    if (!currentCard || !trimmed) return;

    const parsed = parseLine(trimmed);
    if (parsed) currentCard.push(parsed);
  });

  if (!cards.length) {
    throw new Error("Nenhum contato encontrado no arquivo .vcf.");
  }

  return {
    rows: cards.map((vcard, index) => buildRow(vcard, index + 1)),
    totalRows: cards.length
  };
}
