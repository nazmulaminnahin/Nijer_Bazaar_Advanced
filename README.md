# নিজের বাজার — Nijer Bazaar

A production-oriented, Bangladesh-first e-commerce platform: a Bangla storefront
for customers and a full operations back office (orders, inventory, accounting,
CRM, promotions, staff & payroll) for the shop owner.

- **Storefront:** React 18 + Vite + Tailwind (Bangla UI, ৳ BDT, bKash/Nagad/COD, থানা-based addressing)
- **Admin panel:** same SPA under `/admin`, role + permission based
- **API:** Express 5 + Drizzle ORM, PostgreSQL in production or embedded PGlite for local dev
- **Tests:** Vitest + Supertest (60 passing)

---

## 1. Quick start (no database install required)

Full copy-and-paste instructions, demo credentials, customer registration, and
admin password recovery are in [`SETUP.md`](./SETUP.md).

```bash
# 1) API (from the project root)
cd server
cp .env.example .env
npm install
# Edit .env and set SEED_ADMIN_PASSWORD to the value in SETUP.md
npm run db:migrate     # create schema
npm run db:seed        # settings, shipping zones, categories, demo products, admin
npm run dev            # http://localhost:5000

# 2) Storefront + admin (second terminal, from the project root)
cd client
npm install
npm run dev            # http://localhost:5173
```

`DB_DRIVER=pglite` keeps everything inside `server/.pglite`, so local setup
needs no database installation. Switch to `DB_DRIVER=postgres` and configure
`DATABASE_URL` for production. Customer registration requires a password of at
least 8 characters, matching the API's server-side validation.

### Seeded admin login

| Field | Value |
|---|---|
| URL | http://localhost:5173/admin/login |
| Email | `admin@nijerbazaar.com` (or phone `01700000000`) |
| Password | `NB-LocalDemo!26-8fQ` (local-evaluation only; change before deployment) |

On an existing database, `db:seed` intentionally preserves the current admin
password. Use the documented, explicit `npm run admin:reset-password` recovery
command in `SETUP.md` if you need to recover access; it changes no other data.

> Demo product images are generated locally by the seed script (sharp), so no
> third-party image URLs are required.

---

## 2. Commands

| Folder | Command | What it does |
|---|---|---|
| `server` | `npm run dev` | API with hot reload (tsx watch) |
| `server` | `npm run db:migrate` | Apply `server/drizzle/*.sql` |
| `server` | `npm run db:seed` | Idempotent seed (settings, zones, demos) |
| `server` | `npm test` | Vitest + Supertest suite (isolated temp DB) |
| `server` | `npm run typecheck` | `tsc --noEmit` |
| `client` | `npm run dev` | Vite dev server with `/api` proxy |
| `client` | `npm run build` | Type-checked production build → `client/dist` |
| `client` | `npm run typecheck` | `tsc --noEmit` |

`npm run build` inside `client/` also serves as the single-binary deployment
mode: the API automatically serves `client/dist` when it exists.

---

## 3. Project layout

```
server/
  src/
    config/        env, permissions, settings registry, BD geo data
    schemas/       Drizzle table definitions (single source of truth)
    routes/        public storefront + /api/admin/* route modules
    services/      pricing, orders, coupons, gift cards, invoicing, cards, audit, notifications
    middleware/    auth (customer/admin JWT), RBAC, validation, uploads, rate limit
    utils/         helpers (money, phone, invoice numbering, slugs)
  drizzle/         generated SQL migrations
  tests/           Vitest + Supertest suites
  uploads/         local uploads (served at /uploads)
client/
  src/
    components/    ui kit, customer components, layouts (customer + admin shell)
    pages/         customer/* and admin/* screens
    store/         zustand stores (auth, admin, cart, settings)
    lib/           axios clients, formatting, toasts, helpers
docs/              screenshots + technical report
```

---

## 4. Feature map

**Storefront** — hero/promo layout, category grid, flash-sale countdown, best
sellers, featured/new tabs, published testimonials, product detail with gallery,
wishlist, cart with coupon + shipping quote, checkout with division → district →
থানা, order tracking, profile (info / orders / wishlist / addresses), contact form.

**Admin** — dashboard KPIs & charts (all derived from real orders), order
management with legal status transitions + item editing + invoice print,
product & category CRUD with uploads, inventory ledger + adjustments, customer
CRM (ক্রমিক নং / নাম / মোবাইল / ইমেইল + notes + contact-message inbox), coupons
with artwork, gift cards with real barcodes, flash sales, transactions vs
expenses accounting, reports with CSV export, staff + payroll, couriers,
notification providers/logs/templates, and a registry-driven settings screen
(branding, logo upload, shipping & free-shipping rules, payment numbers).

**Shipping rule (server-enforced)** — inside Dhaka: ৳60, free above the
admin-configured threshold (default ৳999) when free shipping is enabled and the
scope is `inside_dhaka` or `all`; outside Dhaka: ৳120, never free unless the
admin sets scope to `all`. Constants live in settings, not in code.

**Honesty rules baked in** — no fake reviews, no invented metrics, notification
channels report `configured: false` and refuse to "send" until real credentials
exist, and accounting keeps transactions and expenses in separate books.

---

## 5. Deployment notes

1. `DB_DRIVER=postgres` + `DATABASE_URL`, run `npm run db:migrate`.
2. Set strong `JWT_SECRET` / `JWT_ADMIN_SECRET` (different values).
3. `cd client && npm run build`, then `cd server && npm run build && npm start`.
4. Serve behind HTTPS; put `/uploads` on persistent storage (or swap the multer
   disk storage for S3-compatible storage in `src/middleware/upload.ts`).
5. Keep `client/dist` next to the API (the server serves it with SPA fallback).

---

Made by Engr. Nazmul Amin.
