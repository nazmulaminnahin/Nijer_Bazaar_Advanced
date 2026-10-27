# নিজের বাজার — Nijer Bazaar
## Technical Restore & Hardening Report (13 parts)

**Branch:** `restore/production-hardening`
**Date:** 26 October 2026
**Scope verified locally:** API on `http://localhost:5000`, storefront + admin on `http://localhost:5173`

---

## 1. Executive summary

The original repository was a partially-scaffolded MERN-style shop with hardcoded
credentials, placeholder routes, mocked data and a front end that mostly did not
compile against its own API. It has been rebuilt into a working platform with:

| Area | State |
|---|---|
| API (Express 5 + Drizzle) | Complete: 24 route modules, service layer, RBAC, validation |
| Database | Single schema source, 41 tables, 2 generated migrations, idempotent seed |
| Storefront | 12 customer screens, Bangla UI, full cart → checkout → order flow |
| Admin panel | 18 screens, permission-aware navigation, real data only |
| Automated tests | **60 passing** (Vitest + Supertest, isolated temp database) |
| Type checks | `tsc --noEmit` clean on **both** server and client |
| Production build | `vite build` succeeds (code-split per page) |
| End-to-end proof | Order `NB-261026-0002` placed in a real browser session |

Nothing in this report is projected or estimated: every number below was
produced by running the code in this workspace.

---

## 2. What the original repository actually contained

Audited before changing anything (`git log`, file tree, `package.json` of both
apps, and the existing `controllers/`, `routes/`, `models/`):

- **Backend:** Express + Mongoose-style controllers mixed with a half-finished
  Drizzle migration; duplicated schema definitions; several catch-all routes
  returning `{ success: true }` without touching the database; JWT secrets
  hardcoded in source; admin login checked a plaintext password from `.env`.
- **Frontend:** CRA-era React with CSS modules, a global axios instance with no
  interceptors, and pages calling endpoints that did not exist
  (`/api/auth/customer/login`, `/api/orders/create`, …).
- **Broken behaviour that the owner reported:** wishlist that never persisted,
  addresses without থানা, cart thumbnails never rendering, free shipping that
  ignored the admin setting (the "Dhaka > ৳999" bug), an admin dashboard with
  static numbers, order lists that could not be filtered, invoices named
  `invoice.pdf`, missing customer CRM columns, and gift cards/coupons whose
  "barcodes" were decorative CSS stripes.
- **Assets supplied by the owner:** `Logo.png`, `Logo with Name.png`,
  `Gift Card Sample.jpg`, `Coupon Card Sample.jpg` — now copied into
  `client/public/brand/` and `docs/assets/`.

Deleted during the rebuild (do not re-add): `server/src/controllers/`,
legacy stub routes, the duplicated `server/src/db/schema.ts`, and the whole
legacy `client/src/{components,pages,store,lib,types,assets}` tree.

---

## 3. Architecture and data model

**Runtime shape:** one Express app (port 5000) serves `/api/*`, `/uploads/*`
and, when `client/dist` exists, the SPA with history fallback. The SPA (Vite,
port 5173 in dev) proxies `/api` and `/uploads` so there is no CORS in
development and a single origin in production.

**Database:** PostgreSQL through Drizzle ORM. Two drivers are supported from the
same code path — `node-postgres` for production and **PGlite** (Postgres
compiled to WASM) for local development and tests, so the project runs with no
database install. Schema lives only in `server/src/schemas/*` and is exported
through one barrel (`schemas/index.ts`); migrations are generated into
`server/drizzle/` (currently `0000_little_randall_flagg.sql` and the additive
`0001_contact_messages.sql`).

41 tables, including: `users`, `admins`, `admin_permissions`, `staff_profiles`,
`salary_payments`, `work_assignments`, `staff_logs`, `categories`, `products`,
`product_images`, `product_variants`, `orders`, `order_items`,
`order_status_history`, `order_audit_log`, `cart`, `wishlist`, `addresses`,
`shipping_zones`, `coupons`, `coupon_usages`, `gift_cards`,
`gift_card_transactions`, `flash_sales`, `reviews`, `testimonials`,
`inventory`, `inventory_log`, `warehouses`, `fulfillment_tasks`, `transactions`,
`expenses`, `notifications`, `notification_templates`, `notification_logs`,
`crm_notes`, `customer_segments`, `loyalty_transactions`, `contact_messages`,
`settings`.

**Money and stock are never trusted from the client:** the order route reloads
every product, re-prices the basket, re-quotes shipping, re-validates the coupon
and decrements stock inside one transaction.

---

## 4. Backend: services and business rules

- `pricing.ts` — single source of truth for shipping and totals. Zone resolution
  is district-driven with a wildcard fallback (`outside_dhaka` covers `*`), so an
  unknown or misspelled district can never produce free shipping.
- `order.service.ts` — order numbering (`NB-YYMMDD-NNNN`), invoice numbering
  (`INV-100NN`), an explicit status machine
  (`pending → confirmed → processing → shipped → delivered`, with
  `cancelled`/`returned` terminal), item editing with re-pricing, and an audit
  row for every mutation.
- `coupon.service.ts` — percentage/flat/free-shipping coupons with minimum order,
  maximum discount cap, total and per-customer usage limits, and best-price
  selection when several coupons overlap.
- `giftcard.service.ts` — unique codes (`NBGC-XXXX-XXXX-XXXX`), issue/credit/
  debit ledger, balance floor at zero (overdraw rejected), expiry handling.
- `card.service.ts` — SVG artwork for coupon and gift-card fronts/backs,
  rasterised to PNG with sharp. Barcodes are drawn with **bwip-js** (real,
  scannable Code-128/SVG output), not CSS stripes.
- `invoice.service.ts` — `INV-10025_Rahim-Ahmed_01712345678_2026-10-25.pdf`
  naming with Unicode-safe transliteration, a data endpoint and a standalone
  printable HTML endpoint (branding, Bengali totals, "Made by Engr. Nazmul Amin").
- `notification.service.ts` + `providers/*` — email/SMS/WhatsApp/push providers
  that expose `isConfigured()`. Unconfigured channels return HTTP 503 and write
  a `failed` delivery log instead of claiming success.
- `audit.service.ts` — every privileged action (order status, item edit,
  inventory adjust, settings, salary, coupon/gift-card changes) is written to
  `staff_logs` with admin id, module, target and IP.
- `settings.service.ts` + `config/settings.registry.ts` — 38 declarative settings
  with Bangla labels, types and validation metadata. The admin UI renders itself
  from this registry, so no label is hardcoded in the client.

---

## 5. The free-shipping bug (root cause and fix)

**Reported symptom:** "Dhaka > ৳999 should be free, but it charges ৳60 — and
sometimes it goes free outside Dhaka."

**Root cause:** the threshold was stored on the shipping-zone row and read
directly by the pricing helper, while the admin Settings screen wrote to the
`settings` table. Nothing linked the two, so editing the setting changed nothing;
and the zone row had `freeShippingEligible = true` on the wildcard match path,
which leaked free shipping outside Dhaka.

**Fix:**
1. `pricing.ts` now takes a `ShippingConfig` built from settings
   (`free_shipping_enabled`, `free_shipping_threshold`, `free_shipping_scope`,
   `inside_dhaka_charge`, `outside_dhaka_charge`) via `loadShippingConfig()`.
2. Eligibility is `enabled && (scope === 'all' || (zone.code === 'inside_dhaka' && zone.freeShippingEligible))`.
3. The quote endpoint (`GET /api/shipping/quote`) and the order route call the
   same function, so the cart, checkout summary and the stored order agree.
4. The UI shows the *reason* returned by the server
   ("ফ্রি ডেলিভারির জন্য আরও ৳350 যোগ করুন") instead of computing it.

**Tests:** 17 pricing tests cover inside/outside Dhaka at ৳998/৳999/৳2500, the
admin toggle being off, an edited threshold of ৳2000, scope `all`, an unknown
district falling back to the wildcard zone, the remaining-amount message,
percentage cap, flat discount larger than the subtotal, minimum order,
`free_shipping` coupons, a negative-total guard, rounding, and overlapping promos.

---

## 6. Storefront (customer experience)

Modelled on the supplied reference layout, rebuilt as its own design system
(no copied markup or assets):

1. Announcement strip → sticky header (search, wishlist, cart badge, account menu)
2. Full-bleed gradient hero with two CTAs and live product tiles
3. Five trust badges (delivery, authenticity, returns, COD, service hours)
4. Category grid (12 tiles, Bangla names)
5. Flash sale band with a live HH:MM:SS countdown driven by the real campaign end time
6. Product grid with Featured / New arrivals / Best sellers tabs
7. Published testimonials only (no invented reviews)
8. Newsletter/CTA band and a four-column footer ending in
   **"Made by Engr. Nazmul Amin"** (admin-configurable `footer_attribution`)

Screens delivered: Home, Shop (search + category + price + in-stock + flash
filters, sort, grid/list, pagination), Product detail (gallery, wishlist,
quantity, related), Cart (server quote, coupon), Checkout (division → district →
থানা with suggestions, saved addresses, payment choice, server totals), Login,
Register, Profile (info / orders / wishlist / addresses), Track order,
About, Contact, 404.

---

## 7. Admin panel

Sidebar → main area shell with search, notification bell (real feed), role badge
and account menu. Screens: Dashboard, Orders, Products, Categories, Inventory,
Customers (incl. contact-message inbox), Customer reviews, Coupons, Gift cards,
Flash sales, Transactions, Expenses, Reports, Staff & payroll, Couriers,
Notifications, Settings.

- **Dashboard** – 8 clickable KPI cards (today's orders, pending, shipped,
  revenue, period revenue with growth, period orders, customers, low stock),
  revenue/order area chart, order-status donut + bar chart, recent orders, best
  sellers, low-stock list. Every figure comes from `/api/admin/dashboard` and
  `/api/admin/reports/sales`.
- **Orders** – tabs (all/pending/confirmed/shipped/delivered), search, date
  range, detail drawer with customer + address + totals, next-status buttons
  limited by the server's status machine, courier + tracking assignment, item
  editing (re-prices, logs `order.items_edited`), invoice print/download.
- **Products / Categories** – full CRUD, multi-image upload, featured/new
  toggles, sale price validation (`sale < regular`), auto SKU/slug.
- **Inventory** – catalogue KPIs, low-stock filter, search, adjustment dialog
  (purchase/return/adjustment/damaged/sale) and the stock-movement log.
- **Customers** – table columns exactly as requested
  (`ক্রমিক নং / কাস্টমারের নাম / মোবাইল নাম্বার / ইমেইল`, serial numbers continue
  across pages), order count, lifetime spend, activate/deactivate, CRM notes.
- **Coupons / Gift cards** – creation with real validation, artwork preview and
  PNG download; gift cards have front/back artwork with scannable barcodes and a
  balance ledger.
- **Accounting** – **transactions** (income/refund) and **expenses** in two
  separate screens and two separate tables, with date filters, category
  breakdowns and a reconciliation summary that explicitly refuses to call
  delivered-order value "profit".
- **Staff** – roles (`super_admin/manager/staff/support`), extra permissions,
  deactivation, salary profile and monthly salary payments (duplicate month
  rejected), staff activity log.
- **Settings** – registry-driven form per group (branding, header, footer,
  shipping, payment, notifications, integration) with a logo uploader, a
  sticky "unsaved changes" bar, and a read-back of committed values.

---

## 8. Security and access control

- Separate JWT secrets for customers and admins; an admin token is never
  accepted by customer routes and vice-versa (tested both directions).
- Passwords hashed with bcrypt (12 rounds). Login returns an identical error for
  "no such account" and "wrong password" so accounts cannot be enumerated.
- Deactivated staff cannot log in (401), and their existing tokens are rejected
  on the next request because the account is re-checked.
- Permission-based RBAC (`config/permissions.ts`): a `support` user gets 403 on
  accounting/settings/staff and 200 on orders. Super admin bypasses checks.
- All write endpoints validate input with zod (`validateBody`); uploads are
  limited by type/size, and folders are whitelisted.
- Rate limiting on login (10/10min), registration, admin login (8/10min),
  contact form and a global 600 req/min guard.
- No secrets in source: `.env.example` documents every variable, real `.env` is
  git-ignored, and the seed writes generated credentials to a git-ignored file.
- CORS is an explicit allow-list from `CLIENT_URL`.

---

## 9. Database, seeding and migrations

- `npm run db:migrate` applies generated SQL through the configured driver, and
  now self-heals a PGlite data directory whose empty sub-directories were lost
  during archiving (`src/db/pgliteDirs.ts`) — this was a real failure observed in
  this environment, not a theoretical one.
- `npm run db:seed` is idempotent: 38 settings, 2 shipping zones, couriers,
  5 categories, 8 demo products with locally generated placeholder images
  (sharp, no external URLs), demo coupons/gift card, admin + staff profile.
- Demo admin: `admin@nijerbazaar.com` / phone `01700000000`; the local-evaluation
  password and setup sequence are in `SETUP.md`. Set `SEED_ADMIN_PASSWORD` before
  the first seed. Existing admin credentials are intentionally preserved by
  `db:seed`; `npm run admin:reset-password` provides an explicit, non-destructive
  recovery that only changes the configured admin password.

---

## 10. Automated tests

`cd server && npm test` → **2 files, 60 tests, all passing** (≈8 s, isolated
temporary database per file, no writes to the development database).

Coverage by area: pricing & free shipping (17), auth and RBAC, wishlist,
addresses (422 without থানা), shipping quote endpoint, order placement with
server-side re-pricing and stock decrement, oversell rejection, coupons
(validation, cap, reuse), admin order filters and status machine, item editing
with audit entry, dashboard stats, customer columns and serials, settings
persistence and validation, gift cards (unique codes, overdraw, ledger, artwork),
invoice filenames, accounting separation, notification honesty, and the
contact-form pipeline (valid message, triage, invalid status).

Client verification: `npx tsc --noEmit` → 0 errors; `npm run build` → success.

---

## 11. Browser verification (evidence)

All screens were driven in Chromium against the running API; console was
checked for errors on every page.

| Check | Result |
|---|---|
| Storefront home, shop (8 products), product detail | renders, 0 console errors |
| Cart → checkout with division/district/থানা → order placed | **`NB-261026-0002`**, invoice `INV-10002`, total ৳910 (৳850 + ৳60 delivery) |
| Profile tabs (info/orders/wishlist/addresses), tracking, about, contact, 404 | render, 0 console errors |
| Contact form submit | 201, message visible in admin inbox |
| Admin login → 16 admin screens | all render real data, 0 console errors |
| Authentication forms | admin sign-in, customer registration (auto-login), customer sign-in all pass in Chromium |
| Notifications page | providers show "কনফিগার করা নেই" (honest state) |

Screenshots: `docs/screenshots/customer-*.png`, `docs/screenshots/admin-*.png`.

**Deliverable re-verification:** the shipped ZIP was extracted into an empty
directory and re-run from scratch — `tsc --noEmit` clean on both apps,
`vite build` succeeded, `db:migrate` + `db:seed` created a fresh database,
`vitest run` passed 60/60, the API booted on a spare port, served the built SPA
at `/`, and admin login returned a token. Fresh-database smoke checks also
verified the documented admin credential, customer registration and subsequent
login; the browser registration/login/admin-login flows reached their expected
signed-in destinations.

---

## 12. Fixed bugs and removed anti-patterns

| Issue | Resolution |
|---|---|
| Free shipping ignored admin setting | Configuration-driven pricing (part 5) |
| Dashboard with hardcoded numbers | All KPIs/ charts from SQL aggregates |
| Orders unfilterable / illegal status jumps | Status machine + filter tabs (`"কনফার্মড" থেকে "ডেলিভার্ড" এ সরাসরি পরিবর্তন সম্ভব নয়।`) |
| Invoice always `invoice.pdf` | Customer/date/number-based filename + print view |
| Cart images blank | Stored image path on order items, `SmartImage` fallback everywhere |
| Addresses without থানা | থানা required (422) + datalist suggestions from BD geo data |
| Decorative "barcodes" | bwip-js Code-128, verified scannable output |
| Fake sending in notifications | `configured:false`, 503, failed delivery rows |
| Spanish word in invoice HTML | Bangla labels throughout |
| Public `GET /api/flash-sales/active` returned 401 | Public router mounted before the auth-guarded admin router |
| Settings saved but lost after refresh | Save returns committed values read back from the DB |
| Customer registration accepted 6 chars in UI but API required 8 | Frontend and API both enforce 8 characters; added registration → immediate login integration coverage |
| Expired persisted auth could leave a stale logged-in UI | 401 responses clear in-memory and persisted customer/admin state; admin login verifies a stored session before redirect |
| Existing admin password unknown | Added an explicit opt-in password reset command that updates only the configured admin account, preserving all other data |

---

## 13. Known limitations and honest gaps

1. **Invoice PDF:** the server produces invoice *data* and a standalone,
   print-ready HTML document with the target `.pdf` filename; turning it into a
   binary PDF currently relies on the browser's "Save as PDF". No server-side
   PDF renderer is wired up yet (pdfkit is installed but unused). Bengali text in
   a generated PDF needs a bundled Unicode font — that is the follow-up work.
2. **Notifications:** email/SMS/WhatsApp/push adapters are implemented but no
   provider is configured, so nothing can be delivered until real credentials
   are supplied. The UI says so instead of faking success.
3. **Order/invoice sequence:** numbering still derives from `COUNT(*)`, which can
   collide under concurrent inserts. A dedicated counter table is the correct
   fix and is documented as pending.
4. **PGlite is a development/demo driver.** Production must use `DB_DRIVER=postgres`.
   Its data directory must be archived with empty sub-directories intact (the
   server now repairs them automatically).
5. **No deployment performed.** Nothing was pushed, deployed or published; the
   ZIP is a local, verified snapshot.
6. **Reference sites:** the customer design was modelled on the layout of the
   supplied reference (structure/content ideas only, no copied markup or assets);
   no proprietary code or imagery was reused.
7. **Payment gateways:** COD/bKash/Nagad are recorded as payment methods; there is
   no live gateway integration or automatic reconciliation.

---

Made by Engr. Nazmul Amin.
