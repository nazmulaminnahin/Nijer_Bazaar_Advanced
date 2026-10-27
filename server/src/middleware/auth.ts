import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { verifyCustomerToken } from '../utils/jwt';

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
}

export function authenticate(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('Please log in to continue.', 401));
  }
  try {
    const decoded = verifyCustomerToken(header.slice(7));
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    return next();
  } catch {
    return next(new AppError('Your session has expired. Please log in again.', 401));
  }
}

/** Attaches userId when a valid token exists, but never rejects. */
export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.userId = verifyCustomerToken(header.slice(7)).userId;
    } catch {
      /* ignore invalid token for optional routes */
    }
  }
  return next();
}
