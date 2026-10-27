import fs from 'fs';
import path from 'path';

/**
 * Embedded PGlite stores a full Postgres data directory on disk. Some of its
 * sub-directories are intentionally empty, and empty directories do not survive
 * archiving/snapshotting (zip, git, container images). When they go missing
 * Postgres aborts with `could not open directory "pg_tblspc"` and the whole API
 * refuses to boot.
 *
 * This runs before the engine starts and recreates only the directories that
 * are expected to exist and be empty. It never touches existing data files.
 */
const REQUIRED_EMPTY_DIRS = [
  'pg_tblspc',
  'pg_notify',
  'pg_serial',
  'pg_snapshots',
  'pg_stat',
  'pg_stat_tmp',
  'pg_subtrans',
  'pg_twophase',
  'pg_replslot',
  'pg_dynshmem',
  'pg_commit_ts',
  'pg_logical/snapshots',
  'pg_logical/mappings',
  'pg_wal/archive_status',
  'pg_wal/summaries',
];

export function ensurePgliteDirs(dir: string): string[] {
  const versionFile = path.join(dir, 'PG_VERSION');
  // A brand-new database: let PGlite create the whole cluster itself.
  if (!fs.existsSync(versionFile)) return [];
  const recreated: string[] = [];
  for (const relative of REQUIRED_EMPTY_DIRS) {
    const full = path.join(dir, relative);
    if (!fs.existsSync(full)) {
      fs.mkdirSync(full, { recursive: true });
      recreated.push(relative);
    }
  }
  if (recreated.length) {
    console.warn(`⚠️  Recreated missing PGlite directories: ${recreated.join(', ')}`);
  }
  return recreated;
}
