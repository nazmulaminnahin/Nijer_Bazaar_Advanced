import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export class AppError extends Error {
  statusCode: number;
  code?: string;
  details?: unknown;
  isOperational = true;

  constructor(message: string, statusCode = 400, options: { code?: string; details?: unknown } = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = options.code;
    this.details = options.details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/** Alias kept for backwards compatibility with existing imports. */
export const ApiError = AppError;

export const asyncHandler =
  <T extends Request>(fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as T, res, next)).catch(next);
  };

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
}

export function errorHandler(err: Error | AppError, _req: Request, res: Response, _next: NextFunction) {
  // Postgres unique-violation → friendly 409
  const pg: any = err as any;
  if (pg?.code === '23505' || pg?.code === '23505' /* pglite uses same code */) {
    return res.status(409).json({ success: false, message: 'A record with these details already exists.' });
  }
  if (pg?.code === '23503') {
    return res.status(409).json({ success: false, message: 'This record is referenced by other data and cannot be changed.' });
  }
  if (pg?.code === '23502') {
    return res.status(400).json({ success: false, message: 'A required field is missing.' });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
      details: err.details,
    });
  }

  console.error('❌ Unhandled error:', err);
  return res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(env.isProd ? {} : { debug: err.message }),
  });
}
