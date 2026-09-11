import { ApiError } from "../middleware/error.js";
import { calcularIdade, todayInTimeZone } from "./dates.js";

const BIRTH_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const SEXO_OPTIONS = ["Feminino", "Masculino", "Outro", "Prefiro não informar"];
const MAX_AGE_YEARS = 120;

export function requiredString(value, fieldName, minLength = 1) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length < minLength) {
    throw new ApiError(400, `${fieldName} é obrigatório.`);
  }
  return text;
}

export function optionalString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function optionalPhone(value, fieldName = "telefone", minLength = 8) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length < minLength) {
    throw new ApiError(400, `${fieldName} inválido.`);
  }
  return text;
}

export function optionalBirthDate(value, fieldName = "data de nascimento") {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value).trim();
  if (!text) return null;
  if (!BIRTH_DATE_PATTERN.test(text)) {
    throw new ApiError(400, `${fieldName} deve estar no formato AAAA-MM-DD.`);
  }

  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new ApiError(400, `${fieldName} inválida.`);
  }

  const today = todayInTimeZone();
  if (date.getTime() > today.getTime()) {
    throw new ApiError(400, `${fieldName} não pode ser uma data futura.`);
  }

  const idade = calcularIdade(date, today);
  if (idade > MAX_AGE_YEARS) {
    throw new ApiError(400, `${fieldName} inválida (idade acima de ${MAX_AGE_YEARS} anos).`);
  }

  return date;
}

export function optionalSexo(value, fieldName = "sexo") {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value).trim();
  if (!text) return null;
  if (!SEXO_OPTIONS.includes(text)) {
    throw new ApiError(400, `${fieldName} inválido.`);
  }
  return text;
}

export function parsePositiveMoney(value, fieldName = "valor") {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new ApiError(400, `${fieldName} deve ser um número maior ou igual a zero.`);
  }
  return Number(number.toFixed(2));
}

export function parsePositiveInteger(value, fieldName) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new ApiError(400, `${fieldName} deve ser um número inteiro maior que zero.`);
  }
  return number;
}

export function parseNonNegativeInteger(value, fieldName) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new ApiError(400, `${fieldName} deve ser um número inteiro maior ou igual a zero.`);
  }
  return number;
}

export function parseBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

export function validateEmail(value) {
  const email = requiredString(value, "email").toLowerCase();
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!pattern.test(email)) {
    throw new ApiError(400, "email inválido.");
  }
  return email;
}

export function optionalEmail(value, fieldName = "email") {
  if (value === undefined || value === null || value === "") return "";
  const email = String(value || "").trim().toLowerCase();
  if (!email) return "";
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!pattern.test(email)) {
    throw new ApiError(400, `${fieldName} invalido.`);
  }
  return email;
}

export function parsePagination(query, { defaultPageSize = 50, maxPageSize = 200 } = {}) {
  const hasPagination =
    query?.page !== undefined ||
    query?.pageSize !== undefined ||
    query?.take !== undefined ||
    query?.skip !== undefined;

  if (!hasPagination) {
    return { enabled: false };
  }

  if (query?.take !== undefined || query?.skip !== undefined) {
    const take = Number(query?.take ?? defaultPageSize);
    const skip = Number(query?.skip ?? 0);
    if (!Number.isInteger(take) || take <= 0) {
      throw new ApiError(400, "take deve ser um número inteiro maior que zero.");
    }
    if (!Number.isInteger(skip) || skip < 0) {
      throw new ApiError(400, "skip deve ser um número inteiro maior ou igual a zero.");
    }

    return {
      enabled: true,
      take: Math.min(take, maxPageSize),
      skip
    };
  }

  const page = Number(query?.page ?? 1);
  const pageSize = Number(query?.pageSize ?? defaultPageSize);
  if (!Number.isInteger(page) || page <= 0) {
    throw new ApiError(400, "page deve ser um número inteiro maior que zero.");
  }
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new ApiError(400, "pageSize deve ser um número inteiro maior que zero.");
  }

  const safePageSize = Math.min(pageSize, maxPageSize);

  return {
    enabled: true,
    take: safePageSize,
    skip: (page - 1) * safePageSize
  };
}
