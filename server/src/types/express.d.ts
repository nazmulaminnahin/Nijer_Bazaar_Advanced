// Express request augmentation for authenticated actors.
declare global {
  namespace Express {
    interface Request {
      userId?: number;
      userRole?: string;
      adminId?: number;
      adminEmail?: string;
      adminName?: string;
      adminRole?: string;
      adminPermissions?: string[];
      validatedQuery?: unknown;
    }
  }
}

export {};
