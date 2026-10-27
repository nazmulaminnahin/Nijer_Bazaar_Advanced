import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

let app: any;
let close: () => Promise<void>;
let ids: { categoryId: number; cheapId: number; priceyId: number };
let adminToken: string;
let customerToken: string;
let cleanup: () => Promise<void>;
let createdGiftCode: string;

beforeAll(async () => {
  const helpers = await import('./helpers');
  const created = await helpers.createTestApp();
  app = created.app;
  close = created.close;
  ids = await helpers.seedBasics();
  adminToken = await helpers.loginAdmin(app);
  customerToken = await helpers.loginCustomer(app);
  cleanup = async () => undefined;
}, 120_000);

afterAll(async () => {
  await cleanup?.();
  await close?.();
});

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('authentication', () => {
  it('registers a customer and permits immediate login with the same credentials', async () => {
    const email = `new-customer-${Date.now()}@example.com`;
    const registration = await request(app).post('/api/auth/register').send({
      name: 'New Test Customer', email, password: 'NewCustomer123!',
    });
    expect(registration.status).toBe(201);
    expect(registration.body.token).toBeTruthy();
    expect(registration.body.user.email).toBe(email);

    const login = await request(app).post('/api/auth/login').send({
      identifier: email, password: 'NewCustomer123!',
    });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();
    expect(login.body.user.id).toBe(registration.body.user.id);
  });

  it('rejects customer passwords shorter than eight characters', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Short Password', email: `short-${Date.now()}@example.com`, password: 'short7',
    });
    expect(res.status).toBe(422);
  });

  it('rejects a wrong password with a generic message', async () => {
    const res = await request(app).post('/api/auth/login').send({ identifier: '01712345678', password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.message).toContain('সঠিক নয়');
  });

  it('does not reveal whether an account exists', async () => {
    const missing = await request(app).post('/api/auth/login').send({ identifier: '01999999999', password: 'whatever1' });
    const wrong = await request(app).post('/api/auth/login').send({ identifier: '01712345678', password: 'whatever1' });
    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(missing.body.message).toBe(wrong.body.message);
  });

  it('logs a customer in with email as well as phone', async () => {
    const byEmail = await request(app).post('/api/auth/login').send({ identifier: 'customer@test.com', password: 'Customer123!' });
    const byPhone = await request(app).post('/api/auth/login').send({ identifier: '01712345678', password: 'Customer123!' });
    expect(byEmail.body.token).toBeTruthy();
    expect(byPhone.body.token).toBeTruthy();
  });

  it('logs an administrator in with either email or phone', async () => {
    const byEmail = await request(app).post('/api/auth/admin/login').send({ identifier: 'admin@test.com', password: 'AdminPass123!' });
    const byPhone = await request(app).post('/api/auth/admin/login').send({ identifier: '01700000000', password: 'AdminPass123!' });
    expect(byEmail.status).toBe(200);
    expect(byPhone.status).toBe(200);
    expect(byEmail.body.admin.role).toBe('super_admin');
    expect(byPhone.body.token).toBeTruthy();
  });

  it('blocks protected admin routes without a token', async () => {
    const res = await request(app).get('/api/admin/dashboard');
    expect(res.status).toBe(401);
  });

  it('rejects a customer token on admin routes', async () => {
    const res = await request(app).get('/api/admin/dashboard').set(auth(customerToken));
    expect(res.status).toBe(401);
  });
});

describe('wishlist and addresses', () => {
  it('toggles a product in the wishlist and persists it', async () => {
    const add = await request(app).post(`/api/wishlist/${ids.cheapId}`).set(auth(customerToken));
    expect(add.body.wishlisted).toBe(true);
    const list = await request(app).get('/api/wishlist').set(auth(customerToken));
    expect(list.body.wishlist).toHaveLength(1);
    const remove = await request(app).post(`/api/wishlist/${ids.cheapId}`).set(auth(customerToken));
    expect(remove.body.wishlisted).toBe(false);
  });

  it('creates, edits, defaults and deletes an address', async () => {
    const create = await request(app).post('/api/addresses').set(auth(customerToken)).send({
      name: 'Test Customer', phone: '01712345678', address: 'House 1, Road 2, Mirpur',
      division: 'Dhaka', district: 'Dhaka', thana: 'Mirpur', postalCode: '1216',
    });
    expect(create.status).toBe(201);
    const addressId = create.body.address.id;
    expect(create.body.address.isDefault).toBe(true);

    const update = await request(app).put(`/api/addresses/${addressId}`).set(auth(customerToken)).send({
      name: 'Test Customer', phone: '01712345678', address: 'House 9, Road 9, Uttara',
      division: 'Dhaka', district: 'Dhaka', thana: 'Uttara',
    });
    expect(update.status).toBe(200);
    expect(update.body.address.address).toContain('Uttara');

    const del = await request(app).delete(`/api/addresses/${addressId}`).set(auth(customerToken));
    expect(del.status).toBe(200);
  });

  it('rejects an address without a thana', async () => {
    const res = await request(app).post('/api/addresses').set(auth(customerToken)).send({
      name: 'Test Customer', phone: '01712345678', address: 'Somewhere long enough',
      division: 'Dhaka', district: 'Dhaka',
    });
    expect(res.status).toBe(422);
  });
});

describe('shipping quote endpoint', () => {
  it('matches the documented policy', async () => {
    const inside = await request(app).get('/api/shipping/quote?subtotal=2000&district=Dhaka');
    const outside = await request(app).get('/api/shipping/quote?subtotal=2000&district=Chattogram');
    expect(inside.body.quote.charge).toBe(0);
    expect(outside.body.quote.charge).toBe(120);
  });
});

describe('checkout and orders', () => {
  const place = (body: Record<string, unknown>) =>
    request(app).post('/api/orders').set(auth(customerToken)).send(body);

  it('prices the order on the server and applies free shipping inside Dhaka', async () => {
    const res = await place({
      items: [{ productId: ids.priceyId, quantity: 1 }],
      shippingAddress: { name: 'Test Customer', phone: '01712345678', address: 'House 1, Mirpur', division: 'Dhaka', district: 'Dhaka', thana: 'Mirpur' },
    });
    expect(res.status).toBe(201);
    expect(res.body.order.subtotal).toBe(2500);
    expect(res.body.order.shippingCost).toBe(0);
    expect(res.body.order.total).toBe(2500);
  });

  it('charges delivery outside Dhaka even above the threshold', async () => {
    const res = await place({
      items: [{ productId: ids.priceyId, quantity: 1 }],
      shippingAddress: { name: 'Test Customer', phone: '01712345678', address: 'Agrabad, Chattogram', division: 'Chattogram', district: 'Chattogram', thana: 'Kotwali' },
    });
    expect(res.body.order.shippingCost).toBe(120);
    expect(res.body.order.total).toBe(2620);
  });

  it('ignores a client-supplied price and recalculates from the database', async () => {
    const res = await place({
      items: [{ productId: ids.cheapId, quantity: 1, price: 1 }],
      shippingAddress: { name: 'Test Customer', phone: '01712345678', address: 'House 1, Mirpur', division: 'Dhaka', district: 'Dhaka', thana: 'Mirpur' },
    });
    expect(res.body.order.subtotal).toBe(500);
  });

  it('reduces stock and refuses to oversell', async () => {
    const before = await request(app).get(`/api/products/${ids.priceyId}`);
    const stockBefore = before.body.product.stock;
    await place({
      items: [{ productId: ids.priceyId, quantity: 2 }],
      shippingAddress: { name: 'Test Customer', phone: '01712345678', address: 'House 1, Mirpur', division: 'Dhaka', district: 'Dhaka', thana: 'Mirpur' },
    });
    const after = await request(app).get(`/api/products/${ids.priceyId}`);
    expect(after.body.product.stock).toBe(stockBefore - 2);

    const tooMany = await place({
      items: [{ productId: ids.priceyId, quantity: 999 }],
      shippingAddress: { name: 'Test Customer', phone: '01712345678', address: 'House 1, Mirpur', division: 'Dhaka', district: 'Dhaka', thana: 'Mirpur' },
    });
    expect(tooMany.status).toBe(400);
  });

  it('validates the checkout form', async () => {
    const res = await place({ items: [{ productId: ids.cheapId, quantity: 1 }], shippingAddress: { name: 'X', phone: '1', address: 'y', division: 'Dhaka', district: 'Dhaka', thana: '' } });
    expect(res.status).toBe(422);
  });
});

describe('coupons', () => {
  let couponId: number;

  it('creates a coupon and validates the discount server-side', async () => {
    const created = await request(app).post('/api/coupons').set(auth(adminToken)).send({
      code: 'SAVE10', type: 'percentage', value: 10, maxDiscount: 300, minOrderAmount: 1000, usageLimit: 5, expiresAt: '2030-12-31',
    });
    expect(created.status).toBe(201);
    couponId = created.body.coupon.id;

    const ok = await request(app).post('/api/coupons/validate').send({ code: 'SAVE10', orderAmount: 2000 });
    expect(ok.body.discountAmount).toBe(200);

    const capped = await request(app).post('/api/coupons/validate').send({ code: 'SAVE10', orderAmount: 9000 });
    expect(capped.body.discountAmount).toBe(300);

    const belowMin = await request(app).post('/api/coupons/validate').send({ code: 'SAVE10', orderAmount: 500 });
    expect(belowMin.status).toBe(400);
  });

  it('applies the coupon on order creation and records usage', async () => {
    const res = await request(app).post('/api/orders').set(auth(customerToken)).send({
      items: [{ productId: ids.priceyId, quantity: 1 }],
      couponCode: 'SAVE10',
      shippingAddress: { name: 'Test Customer', phone: '01712345678', address: 'House 1, Mirpur', division: 'Dhaka', district: 'Dhaka', thana: 'Mirpur' },
    });
    expect(res.body.order.discount).toBe(250);
    expect(res.body.order.total).toBe(2250);
  });

  it('blocks the same customer from reusing a single-use coupon', async () => {
    const res = await request(app).post('/api/orders').set(auth(customerToken)).send({
      items: [{ productId: ids.cheapId, quantity: 4 }],
      couponCode: 'SAVE10',
      shippingAddress: { name: 'Test Customer', phone: '01712345678', address: 'House 1, Mirpur', division: 'Dhaka', district: 'Dhaka', thana: 'Mirpur' },
    });
    expect(res.status).toBe(400);
  });

  it('renders coupon artwork with a scannable barcode', async () => {
    const res = await request(app).get(`/api/coupons/${couponId}/design`).set(auth(adminToken));
    const svg = res.text ?? res.body.toString();
    expect(res.headers['content-type']).toContain('svg');
    expect(svg).toContain('SAVE');
    expect(svg).toContain('<path'); // real barcode bars
    expect(svg).toContain('শর্তাবলী');
  });
});

describe('admin order management', () => {
  let orderId: number;

  it('filters All / Pending / Shipped views distinctly', async () => {
    const all = await request(app).get('/api/orders/admin/all?status=all').set(auth(adminToken));
    orderId = all.body.orders[0].id;
    const pending = await request(app).get('/api/orders/admin/all?status=pending').set(auth(adminToken));
    const shipped = await request(app).get('/api/orders/admin/all?status=shipped').set(auth(adminToken));
    expect(all.body.orders.length).toBeGreaterThan(0);
    expect(pending.body.orders.every((o: any) => o.status === 'pending')).toBe(true);
    expect(shipped.body.orders.length).toBe(0);
  });

  it('enforces the status transition graph', async () => {
    const bad = await request(app).put(`/api/orders/admin/${orderId}/status`).set(auth(adminToken)).send({ status: 'delivered' });
    expect(bad.status).toBe(422);
    const ok = await request(app).put(`/api/orders/admin/${orderId}/status`).set(auth(adminToken)).send({ status: 'confirmed' });
    expect(ok.status).toBe(200);
    const moved = await request(app).get('/api/orders/admin/all?status=confirmed').set(auth(adminToken));
    expect(moved.body.orders.some((o: any) => o.id === orderId)).toBe(true);
  });

  it('edits order items, recalculates totals and audits the change', async () => {
    const res = await request(app)
      .put(`/api/orders/admin/${orderId}/items`)
      .set(auth(adminToken))
      .send({ items: [{ productId: ids.cheapId, quantity: 3 }], reason: 'customer called' });
    expect(res.status).toBe(200);
    expect(res.body.order.subtotal).toBe(1500);
    expect(res.body.order.items[0].quantity).toBe(3);
    expect(res.body.order.auditTrail.some((a: any) => a.action === 'order.items_edited')).toBe(true);
  });

  it('rejects invalid item quantities', async () => {
    const res = await request(app)
      .put(`/api/orders/admin/${orderId}/items`)
      .set(auth(adminToken))
      .send({ items: [{ productId: ids.cheapId, quantity: 0 }] });
    expect(res.status).toBe(422);
  });

  it('reports dashboard metrics from real records', async () => {
    const res = await request(app).get('/api/admin/dashboard').set(auth(adminToken));
    expect(res.body.stats.totalOrders).toBeGreaterThan(0);
    expect(res.body.stats.totalRevenue).toBeGreaterThan(0);
    expect(res.body.stats.revenueGrowth === null || typeof res.body.stats.revenueGrowth === 'number').toBe(true);
  });

  it('lists customers with the requested column order and serials across pages', async () => {
    const page1 = await request(app).get('/api/admin/customers?page=1&limit=1').set(auth(adminToken));
    expect(page1.body.columns).toEqual(['ক্রমিক নং', 'কাস্টমারের নাম', 'মোবাইল নাম্বার', 'ইমেইল']);
    const row = page1.body.customers[0];
    expect(Object.keys(row).slice(0, 4)).toEqual(['serial', 'id', 'name', 'phone']);
    expect(row.serial).toBe(1);
  });
});

describe('settings persistence', () => {
  it('persists a change and returns it after a fresh read', async () => {
    const put = await request(app).put('/api/admin/settings').set(auth(adminToken)).send({ free_shipping_threshold: 1500, header_promo_text: 'নতুন অফার' });
    expect(put.status).toBe(200);
    const get = await request(app).get('/api/admin/settings').set(auth(adminToken));
    expect(get.body.settings.free_shipping_threshold).toBe('1500');
    expect(get.body.settings.header_promo_text).toBe('নতুন অফার');

    // The storefront reads the same value.
    const pub = await request(app).get('/api/settings');
    expect(pub.body.settings.header_promo_text).toBe('নতুন অফার');

    // …and checkout follows the edited threshold.
    const quote = await request(app).get('/api/shipping/quote?subtotal=1200&district=Dhaka');
    expect(quote.body.quote.charge).toBe(60);
  });

  it('rejects unknown keys and invalid numbers', async () => {
    expect((await request(app).put('/api/admin/settings').set(auth(adminToken)).send({ not_a_setting: 1 })).status).toBe(400);
    expect((await request(app).put('/api/admin/settings').set(auth(adminToken)).send({ free_shipping_threshold: -5 })).status).toBe(400);
  });
});

describe('gift cards', () => {
  let cardId: number;

  it('creates cards with unique codes and an issue ledger entry', async () => {
    const res = await request(app).post('/api/gift-cards').set(auth(adminToken)).send({ amount: 2000, quantity: 2 });
    expect(res.status).toBe(201);
    expect(res.body.cards).toHaveLength(2);
    expect(new Set(res.body.cards.map((c: any) => c.code)).size).toBe(2);
    cardId = res.body.cards[0].id;
    createdGiftCode = res.body.cards[0].code;

    const ledger = await request(app).get(`/api/gift-cards/${cardId}`).set(auth(adminToken));
    expect(ledger.body.transactions[0].type).toBe('issue');
  });

  it('prevents spending more than the available balance', async () => {
    const res = await request(app).post(`/api/gift-cards/${cardId}/adjust`).set(auth(adminToken)).send({ type: 'debit', amount: 5000 });
    expect(res.status).toBe(400);
  });

  it('debits within balance and records the ledger', async () => {
    const res = await request(app).post(`/api/gift-cards/${cardId}/adjust`).set(auth(adminToken)).send({ type: 'debit', amount: 500 });
    expect(res.status).toBe(200);
    expect(res.body.card.remainingAmount).toBe(1500);
    const ledger = await request(app).get(`/api/gift-cards/${cardId}`).set(auth(adminToken));
    expect(ledger.body.transactions[0].balanceAfter).toBe(1500);
  });

  it('serves front and back artwork with a real barcode', async () => {
    const front = await request(app).get(`/api/gift-cards/${cardId}/design?side=front`).set(auth(adminToken));
    const back = await request(app).get(`/api/gift-cards/${cardId}/design?side=back`).set(auth(adminToken));
    const frontSvg = front.text ?? front.body.toString();
    const backSvg = back.text ?? back.body.toString();
    expect(frontSvg).toContain('GIFT CARD');
    expect(backSvg).toContain(createdGiftCode);
    expect(backSvg).toContain('<path'); // barcode bars
  });
});

describe('invoice', () => {
  it('builds the required filename and sanitises unsafe characters', async () => {
    const { buildInvoiceFilename } = await import('../src/services/invoice.service');
    expect(
      buildInvoiceFilename({ invoiceNumber: 'INV-10025', customerName: 'Rahim Ahmed', phone: '01712345678', date: '2026-10-25' })
    ).toBe('INV-10025_Rahim-Ahmed_01712345678_2026-10-25.pdf');
    expect(
      buildInvoiceFilename({ invoiceNumber: 'INV/10026', customerName: 'রহিম আহমেদ', phone: '017 1234-5678', date: new Date('2026-01-02') })
    ).toMatch(/^INV-10026_[A-Za-z0-9-]+_01712345678_2026-01-02\.pdf$/);
    expect(buildInvoiceFilename({ invoiceNumber: 'X', customerName: '  ', phone: '', date: '2026-01-01' })).toBe('X_customer_no-phone_2026-01-01.pdf');
  });

  it('returns invoice data and printable HTML', async () => {
    const list = await request(app).get('/api/orders/admin/all').set(auth(adminToken));
    const orderId = list.body.orders[0].id;
    const data = await request(app).get(`/api/orders/admin/${orderId}/invoice`).set(auth(adminToken));
    expect(data.body.invoice.filename).toMatch(/\.pdf$/);
    const html = await request(app).get(`/api/orders/admin/${orderId}/invoice/print`).set(auth(adminToken));
    expect(html.text).toContain('INVOICE');
    expect(html.text).toContain('Made by Engr. Nazmul Amin');
  });
});

describe('role based access control', () => {
  it('stops ordinary staff from reading accounting or changing settings', async () => {
    const created = await request(app).post('/api/admin/staff').set(auth(adminToken)).send({
      name: 'Support Agent', phone: '01711111111', email: 'agent@test.com', password: 'AgentPass123!', role: 'support',
    });
    expect(created.status).toBe(201);
    const login = await request(app).post('/api/auth/admin/login').send({ identifier: '01711111111', password: 'AgentPass123!' });
    const staffToken = login.body.token;

    expect((await request(app).get('/api/accounting/transactions').set(auth(staffToken))).status).toBe(403);
    expect((await request(app).put('/api/admin/settings').set(auth(staffToken)).send({ site_name: 'Hacked' })).status).toBe(403);
    expect((await request(app).get('/api/admin/staff').set(auth(staffToken))).status).toBe(403);
    // …but can read orders (part of the support role)
    expect((await request(app).get('/api/orders/admin/all').set(auth(staffToken))).status).toBe(200);
  });

  it('deactivates a staff account and rejects its token immediately', async () => {
    const list = await request(app).get('/api/admin/staff').set(auth(adminToken));
    const agent = list.body.staff.find((s: any) => s.email === 'agent@test.com');
    await request(app).delete(`/api/admin/staff/${agent.id}`).set(auth(adminToken));
    const login = await request(app).post('/api/auth/admin/login').send({ identifier: '01711111111', password: 'AgentPass123!' });
    expect(login.status).toBe(401);
  });
});

describe('accounting separation', () => {
  it('keeps transactions and expenses in different data sets', async () => {
    await request(app).post('/api/accounting/transactions').set(auth(adminToken)).send({ type: 'income', amount: 1000, category: 'sales' });
    await request(app).post('/api/accounting/expenses').set(auth(adminToken)).send({ title: 'Office rent', category: 'rent', amount: 5000 });
    const tx = await request(app).get('/api/accounting/transactions').set(auth(adminToken));
    const ex = await request(app).get('/api/accounting/expenses').set(auth(adminToken));
    expect(tx.body.transactions[0].amount).toBe(1000);
    expect(ex.body.expenses[0].amount).toBe(5000);
    expect(tx.body.transactions[0].title).toBeUndefined();
  });
});

describe('notifications', () => {
  it('reports unconfigured providers honestly instead of pretending to send', async () => {
    const providers = await request(app).get('/api/admin/notifications/providers').set(auth(adminToken));
    expect(providers.body.providers.find((p: any) => p.channel === 'email').configured).toBe(false);
    const test = await request(app).post('/api/admin/notifications/test').set(auth(adminToken)).send({ channel: 'email', to: 'x@test.com' });
    expect(test.status).toBe(503);
    expect(test.body.configured).toBe(false);
  });

  it('records failed delivery attempts in the log', async () => {
    const send = await request(app).post('/api/admin/notifications/send').set(auth(adminToken)).send({
      channels: ['email'], subject: 'Test', body: 'Hello', group: 'all',
    });
    expect(send.status).toBe(200);
    expect(send.body.failed).toBeGreaterThan(0);
    const logs = await request(app).get('/api/admin/notifications/logs').set(auth(adminToken));
    expect(logs.body.logs.some((l: any) => l.status === 'failed')).toBe(true);
  });
});

describe('storefront contact form', () => {
  it('stores a valid message and rejects a bad phone number', async () => {
    const bad = await request(app).post('/api/contact').send({ name: 'Rahim', phone: '123', message: 'hello there' });
    expect(bad.status).toBe(422);

    const ok = await request(app).post('/api/contact').send({
      name: 'Rahim Ahmed',
      phone: '01712345678',
      email: 'rahim@example.com',
      subject: 'ডেলিভারি',
      message: 'আমার অর্ডার কবে পৌঁছাবে?',
    });
    expect(ok.status).toBe(201);
    expect(ok.body.success).toBe(true);
  });

  it('lets staff read and triage the messages', async () => {
    const list = await request(app).get('/api/admin/contact-messages').set(auth(adminToken));
    expect(list.status).toBe(200);
    expect(list.body.messages.length).toBeGreaterThan(0);
    expect(list.body.counts.new).toBeGreaterThan(0);

    const id = list.body.messages[0].id;
    const patch = await request(app).patch(`/api/admin/contact-messages/${id}`).set(auth(adminToken)).send({ status: 'read', adminNote: 'কল করা হয়েছে' });
    expect(patch.status).toBe(200);
    expect(patch.body.data.status).toBe('read');
  });

  it('rejects an invalid status value', async () => {
    const list = await request(app).get('/api/admin/contact-messages').set(auth(adminToken));
    const id = list.body.messages[0].id;
    const res = await request(app).patch(`/api/admin/contact-messages/${id}`).set(auth(adminToken)).send({ status: 'nonsense' });
    expect(res.status).toBe(422);
  });
});
