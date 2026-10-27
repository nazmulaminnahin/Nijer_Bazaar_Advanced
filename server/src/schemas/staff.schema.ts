// Staff/HR tables live in admins.schema.ts (admins, staffProfiles, salaryPayments,
// workAssignments, staffLogs). This module only re-exports them so existing
// imports from './staff.schema' keep working after the schema consolidation.
export {
  admins,
  staffProfiles,
  salaryPayments,
  workAssignments,
  staffLogs,
} from './admins.schema';
export type { Admin, NewAdmin } from './admins.schema';
