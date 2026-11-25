import type { NextFunction, Request, Response } from "express";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "INTERNAL";

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(status: number, code: ErrorCode, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function notFound(message = "Not found"): ApiError {
  return new ApiError(404, "NOT_FOUND", message);
}

export function unauthorized(message = "Unauthorized"): ApiError {
  return new ApiError(401, "UNAUTHORIZED", message);
}

export function validationError(message: string): ApiError {
  return new ApiError(400, "VALIDATION_ERROR", message);
}

/** Wrap async route handlers so thrown errors reach the error handler. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res, next).catch(next);
  };
}

/**
 * Final error handler — every error leaves the API in the contract shape:
 * `{ "error": { "code", "message" } }`.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  // zod errors are converted to ApiError at the validation site; anything
  // else is an internal failure. Never leak stack traces to clients.
  console.error("[AutoFlow] Unhandled error:", err);
  res
    .status(500)
    .json({ error: { code: "INTERNAL", message: "Internal server error" } });
}
