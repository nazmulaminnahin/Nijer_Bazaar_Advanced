import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Small in-memory fixed-window limiter — enough for login/OTP endpoints on a
 * single instance. Swap for a Redis-backed limiter when running multiple nodes.
 */
export function rateLimit(options: { windowMs: number; max: number; keyPrefix?: string }) {
  const buckets = new Map<string, Bucket>();
  return (req: Request, _res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${options.keyPrefix ?? ''}${req.ip}:${(req.body?.identifier ?? req.body?.email ?? req.body?.phone ?? '')}`;
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > options.max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      return next(new AppError(`Too many attempts. Please try again in ${retryAfter} seconds.`, 429));
    }
    return next();
  };
}
