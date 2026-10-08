import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { env } from "../config/env";
import { sendError } from "../utils/response";

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response {
  // Zod Validation Error
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));
    return sendError(res, "VALIDATION_ERROR", "Validation failed", details, 422);
  }

  // SyntaxError in JSON body
  if (err instanceof SyntaxError && "body" in err) {
    return sendError(res, "MALFORMED_JSON", "Invalid JSON body provided", undefined, 400);
  }

  // Custom Application Error
  if (err.status && err.message) {
    return sendError(
      res,
      err.code || "APPLICATION_ERROR",
      err.message,
      err.details,
      err.status
    );
  }

  // Log unhandled server errors
  console.error("Unhandled Error:", err);

  const message =
    env.NODE_ENV === "production" ? "Internal server error" : err.message || "Internal server error";

  return sendError(
    res,
    "INTERNAL_SERVER_ERROR",
    message,
    env.NODE_ENV === "production" ? undefined : err.stack,
    500
  );
}
