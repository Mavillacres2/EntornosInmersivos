import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export function createErrorHandler(production: boolean): ErrorRequestHandler {
  return (error: unknown, _request, response, _next): void => {
    if (isJsonParseError(error)) {
      response.status(400).json({ error: "JSON invalido" });
      return;
    }

    if (error instanceof ZodError) {
      response.status(400).json({
        error: "Payload invalido",
        details: error.issues
      });
      return;
    }

    if (error instanceof ApiError) {
      response.status(error.statusCode).json({
        error: error.message,
        details: error.details
      });
      return;
    }

    const message = error instanceof Error ? error.message : "Error interno";

    if (!production) {
      console.error(error);
    }

    response.status(500).json({
      error: production ? "Error interno del servidor" : message
    });
  };
}

function isJsonParseError(error: unknown): boolean {
  return Boolean(
    error instanceof SyntaxError &&
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      error.status === 400 &&
      "type" in error &&
      error.type === "entity.parse.failed"
  );
}
