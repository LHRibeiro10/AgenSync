export class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export function notFound(req, res) {
  res.status(404).json({ message: "Rota não encontrada." });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error.code === "P2002") {
    return res.status(409).json({ message: "Já existe um registro com esses dados." });
  }

  if (error.code === "P2003") {
    return res.status(409).json({ message: "Não foi possível excluir: existem registros vinculados." });
  }

  if (error.code === "P2021" || error.code === "P2022") {
    return res.status(503).json({
      message: "Banco de dados ainda nao foi atualizado. Rode as migrations do backend e tente novamente."
    });
  }

  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 ? "Erro interno do servidor." : error.message;
  const response = { message };

  if (error.details) {
    response.details = error.details;
  }

  if (statusCode === 500 && process.env.NODE_ENV !== "production") {
    response.debug = error.message;
  }

  res.status(statusCode).json(response);
}
