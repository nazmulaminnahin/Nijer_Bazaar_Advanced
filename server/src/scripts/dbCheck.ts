import 'dotenv/config';
import { Client } from 'pg';

/**
 * Read-only diagnostic. Connects with the same DATABASE_URL as the app,
 * then also tries 127.0.0.1 and ::1, and reports which server answers
 * and whether the 7 expected columns are visible there.
 */
const SQL = `
  select
    current_database() as db,
    inet_server_addr()::text as server_addr,
    inet_server_port() as port,
    current_setting('server_version') as version,
    current_setting('search_path') as search_path,
    (
      select count(*) from information_schema.columns
      where table_schema = 'public' and (
        (table_name = 'categories' and column_name = 'name_bn') or
        (table_name = 'products' and column_name = 'cost_price') or
        (table_name = 'flash_sales' and column_name in ('product_ids','category_ids','stock_limit','created_by')) or
        (table_name = 'admins' and column_name = 'permissions')
      )
    )::int as found_columns_of_7
`;

async function probe(label: string, connectionString: string) {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const { rows } = await client.query(SQL);
    console.log(`\n[${label}]`);
    console.table(rows);
  } catch (err) {
    console.log(`\n[${label}] FAILED:`, (err as Error).message);
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function main() {
  const base = process.env.DATABASE_URL;
  if (!base) {
    console.log('DATABASE_URL is not set.');
    return;
  }

  const withHost = (host: string) => {
    const u = new URL(base);
    u.hostname = host;
    return u.toString();
  };

  const original = new URL(base);
  console.log(`DATABASE_URL host: ${original.hostname}  port: ${original.port || '5432'}  db: ${original.pathname.slice(1)}`);

  await probe('as written in .env', base);
  await probe('forced 127.0.0.1 (IPv4)', withHost('127.0.0.1'));
  await probe('forced ::1 (IPv6)', withHost('[::1]'));
}

main();