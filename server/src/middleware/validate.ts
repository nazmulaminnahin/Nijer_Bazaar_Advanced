import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodTypeAny } from 'zod';
import { AppError } from './errorHandler';

/** Validates req.body against a zod schema and replaces it with parsed data. */
export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      return next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(
          new AppError('Please correct the highlighted fields.', 422, {
            details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
          })
        );
      }
      return next(err);
    }
  };
}

export function validateQuery(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      return next(new AppError('Invalid query parameters.', 422, {
        details: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      }));
    }
    // express 5 exposes req.query as a getter — store the parsed copy separately
    (req as Request & { validatedQuery?: unknown }).validatedQuery = parsed.data;
    return next();
  };
}
