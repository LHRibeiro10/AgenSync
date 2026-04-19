export class ApiError extends Error {
  constructor({ message, status = 0, code = "", details = null, cause } = {}) {
    super(message || "Nao foi possivel concluir a operacao.");
    this.name = "ApiError";
    this.status = Number(status) || 0;
    this.code = code || "";
    this.details = details;
    if (cause) this.cause = cause;
  }
}

export function asApiError(error, fallbackMessage = "Nao foi possivel concluir a operacao.") {
  if (error instanceof ApiError) return error;
  if (error instanceof Error) {
    return new ApiError({ message: error.message || fallbackMessage, cause: error });
  }
  return new ApiError({ message: fallbackMessage, details: error });
}
