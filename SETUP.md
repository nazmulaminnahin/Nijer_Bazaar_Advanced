# Nijer Bazaar — setup and sign-in

These steps start the complete app locally using embedded PGlite; a separate PostgreSQL install is not needed for local evaluation.

## Requirements

- Node.js 20 or newer and npm
- Extract the ZIP to a writable folder
- Internet access for the first `npm install`

## 1. Configure and start the API

Open Terminal / PowerShell in the extracted project folder:

```sh
cd server
cp .env.example .env
npm install
```

Open `server/.env` in a text editor and set `SEED_ADMIN_PASSWORD` to the demo password listed below. Keep `DB_DRIVER=pglite` for local setup. Save the file, then run:

```sh
npm run db:migrate
npm run db:seed
npm run dev
```

Leave this terminal running. The API health check is at `http://localhost:5000/api/health`.

> On Windows, copy `.env.example` to `.env` in File Explorer or run `Copy-Item .env.example .env` in PowerShell. Edit `.env` with Notepad and use the same commands from the `server` directory.

## 2. Start the storefront and admin panel

Open a **second** terminal at the project folder:

```sh
cd client
npm install
npm run dev
```

Open the local website at `http://localhost:5173`.

## Admin sign-in

| Item | Value |
|---|---|
| Admin panel | `http://localhost:5173/admin/login` |
| Email / ID | `admin@nijerbazaar.com` |
| Password | `NB-LocalDemo!26-8fQ` |

This demo password is intentionally included for local evaluation. It is **not** a production credential. Before deployment, use a unique strong value in `server/.env`, rotate both JWT secrets, configure PostgreSQL, and never publish `.env`.

## Customer sign-up and login

Open `http://localhost:5173/register`, enter a name, at least one of email or Bangladesh mobile number, and a password of **8 or more characters**. Registration signs the customer in automatically. Later, use `http://localhost:5173/login` with the same email or phone and password.

## Recover admin access without deleting data

If this database already existed and its admin password is different, changing `.env` alone does not replace an existing account's password. The normal seed deliberately preserves existing admin credentials. To reset only the configured admin password, set `SEED_ADMIN_PASSWORD` in `server/.env` to the desired value, then from the `server` directory run:

```sh
# macOS / Linux
RESET_ADMIN_PASSWORD=true npm run admin:reset-password

# Windows PowerShell
$env:RESET_ADMIN_PASSWORD="true"
npm run admin:reset-password
Remove-Item Env:RESET_ADMIN_PASSWORD
```

The reset requires the explicit confirmation flag, changes only the password for `SEED_ADMIN_EMAIL`, and does not remove orders, products, customers, or other data. For a brand-new setup, run migrations and seed as above instead. Keep the admin account active; the reset command does not reactivate a disabled account.

## Troubleshooting

- **API unavailable / network error:** make sure the API terminal is still running on port `5000`; check `/api/health`.
- **Admin says credentials are incorrect:** check `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `server/.env`. On an existing database, use the non-destructive reset steps above.
- **Registration rejects a password:** it must contain at least 8 characters.
- **Frontend cannot reach the API:** use the Vite development server at port `5173`; it proxies `/api` to `http://localhost:5000` by default.

## Production note

PGlite is for local development/demo, not concurrent production workloads. Use PostgreSQL and the production deployment guidance in `README.md` for a live store.
