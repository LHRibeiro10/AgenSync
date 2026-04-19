import { ApiError } from "../middleware/error.js";

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
    throw new ApiError(400, `${fieldName} deve ser um nÃºmero inteiro maior ou igual a zero.`);
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
