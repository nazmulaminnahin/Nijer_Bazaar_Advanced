import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export interface CustomerTokenPayload {
  userId: number;
  role: 'customer';
}

export interface AdminTokenPayload {
  adminId: number;
  role: string;
  tokenVersion?: number;
}

export function signCustomerToken(payload: CustomerTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as SignOptions);
}

export function signAdminToken(payload: AdminTokenPayload): string {
  return jwt.sign(payload, env.JWT_ADMIN_SECRET, { expiresIn: env.JWT_ADMIN_EXPIRES_IN } as SignOptions);
}

export function verifyCustomerToken(token: string): CustomerTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as CustomerTokenPayload;
}

export function verifyAdminToken(token: string): AdminTokenPayload {
  return jwt.verify(token, env.JWT_ADMIN_SECRET) as AdminTokenPayload;
}
