import { db } from '../config/db';
import type { DbClient } from '../config/db';
import { staffLogs } from '../schemas/index';

/** Records a staff action for the audit trail. Never throws into the request. */
export async function logStaffAction(input: {
  adminId?: number | null;
  action: string;
  module: string;
  targetId?: number | null;
  details?: unknown;
  ip?: string | null;
}, dbc: DbClient = db): Promise<void> {
  try {
    await dbc.insert(staffLogs).values({
      adminId: input.adminId ?? null,
      action: input.action,
      module: input.module,
      targetId: input.targetId ?? null,
      details: input.details ? (typeof input.details === 'string' ? input.details : JSON.stringify(input.details)) : null,
      ipAddress: input.ip ?? null,
    });
  } catch (err) {
    console.error('Failed to write audit log:', (err as Error).message);
  }
}
