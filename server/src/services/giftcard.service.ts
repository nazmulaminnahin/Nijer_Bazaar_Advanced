import { and, count, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '../config/db';
import type { DbClient } from '../config/db';
import { giftCardTransactions, giftCards } from '../schemas/index';
import { AppError } from '../middleware/errorHandler';
import { generateGiftCardCode, money } from '../utils/helpers';

export interface CreateGiftCardInput {
  amount: number;
  quantity?: number;
  expiresAt?: string | null;
  design?: string;
  recipientName?: string;
  recipientPhone?: string;
  message?: string;
  createdBy?: number;
}

/**
 * Issues one or more cards with unique codes. Every card gets an `issue`
 * ledger entry so the balance history is complete from day one.
 */
export async function createGiftCards(input: CreateGiftCardInput) {
  const amount = money(input.amount);
  if (!(amount > 0)) throw new AppError('গিফট কার্ডের পরিমাণ ০ এর বেশি হতে হবে।', 422);
  if (amount > 200_000) throw new AppError('সর্বোচ্চ ২,০০,০০০ টাকার গিফট কার্ড তৈরি করা যাবে।', 422);
  const quantity = Math.min(50, Math.max(1, Math.floor(input.quantity ?? 1)));
  const expiry = input.expiresAt ? new Date(input.expiresAt) : null;
  if (expiry && Number.isNaN(expiry.getTime())) throw new AppError('মেয়াদের তারিখ সঠিক নয়।', 422);

  return db.transaction(async (tx) => {
    const created = [];
    for (let i = 0; i < quantity; i += 1) {
      let code = generateGiftCardCode();
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const [clash] = await tx.select({ id: giftCards.id }).from(giftCards).where(eq(giftCards.code, code)).limit(1);
        if (!clash) break;
        code = generateGiftCardCode();
      }
      const [card] = await tx
        .insert(giftCards)
        .values({
          code,
          initialAmount: String(amount),
          remainingAmount: String(amount),
          expiryDate: expiry,
          design: input.design ?? 'classic',
          recipientName: input.recipientName ?? null,
          recipientPhone: input.recipientPhone ?? null,
          message: input.message ?? null,
          createdBy: input.createdBy ?? null,
          status: 'active',
        })
        .returning();
      await tx.insert(giftCardTransactions).values({
        giftCardId: card.id, type: 'issue', amount: String(amount), balanceAfter: String(amount),
        note: 'Gift card issued', adminId: input.createdBy ?? null,
      });
      created.push(card);
    }
    return created;
  });
}

export async function listGiftCards(params: { page: number; limit: number; search?: string; status?: string }, dbc: DbClient = db) {
  const conditions = [];
  if (params.search) {
    conditions.push(or(ilike(giftCards.code, `%${params.search}%`), ilike(giftCards.recipientName, `%${params.search}%`))!);
  }
  if (params.status && params.status !== 'all') conditions.push(eq(giftCards.status, params.status));
  const where = conditions.length ? and(...conditions) : undefined;

  const [totalRow] = await dbc.select({ value: count() }).from(giftCards).where(where);
  const rows = await dbc
    .select()
    .from(giftCards)
    .where(where)
    .orderBy(desc(giftCards.createdAt))
    .limit(params.limit)
    .offset((params.page - 1) * params.limit);

  const totals = await dbc
    .select({
      issued: count(),
      outstanding: (await import('drizzle-orm')).sql<number>`coalesce(sum(${giftCards.remainingAmount}), 0)`,
    })
    .from(giftCards);

  const total = Number(totalRow?.value ?? 0);
  return {
    data: rows.map(serializeGiftCard),
    total,
    pagination: { page: params.page, limit: params.limit, total, totalPages: Math.max(1, Math.ceil(total / params.limit)) },
    summary: { cards: Number(totals[0]?.issued ?? 0), outstanding: Number(totals[0]?.outstanding ?? 0) },
  };
}

export function serializeGiftCard(card: typeof giftCards.$inferSelect) {
  const expired = card.expiryDate ? card.expiryDate.getTime() < Date.now() : false;
  return {
    id: card.id,
    code: card.code,
    initialAmount: Number(card.initialAmount),
    initialBalance: Number(card.initialAmount),
    remainingAmount: Number(card.remainingAmount),
    currentBalance: Number(card.remainingAmount),
    status: expired && card.status === 'active' ? 'expired' : card.status,
    isActive: card.isActive && !expired,
    design: card.design,
    recipientName: card.recipientName,
    recipientPhone: card.recipientPhone,
    message: card.message,
    expiresAt: card.expiryDate ? card.expiryDate.toISOString() : null,
    createdAt: card.createdAt.toISOString(),
  };
}

async function cardByCodeOrId(dbc: DbClient, identifier: string | number) {
  const [card] = await dbc.select().from(giftCards).where(typeof identifier === 'number' ? eq(giftCards.id, identifier) : eq(giftCards.code, String(identifier).toUpperCase())).limit(1);
  if (!card) throw new AppError('গিফট কার্ড পাওয়া যায়নি।', 404);
  return card;
}

/**
 * Adjusts a card balance through the ledger.
 * Debits can never exceed the available balance (no negative balances) and an
 * exhausted card is marked as redeemed.
 */
export async function adjustGiftCardBalance(input: {
  identity: string | number;
  type: 'credit' | 'debit';
  amount: number;
  note?: string;
  adminId?: number;
  orderId?: number;
}) {
  const amount = money(input.amount);
  if (!(amount > 0)) throw new AppError('পরিমাণ ০ এর বেশি হতে হবে।', 422);

  return db.transaction(async (tx) => {
    const card = await cardByCodeOrId(tx as never, input.identity);
    if (card.status === 'inactive' || !card.isActive) throw new AppError('এই গিফট কার্ডটি নিষ্ক্রিয়।', 400);
    if (card.expiryDate && card.expiryDate.getTime() < Date.now()) throw new AppError('এই গিফট কার্ডের মেয়াদ শেষ হয়েছে।', 400);

    const current = money(card.remainingAmount);
    if (input.type === 'debit' && amount > current) {
      throw new AppError(`কার্ডে পর্যাপ্ত ব্যালেন্স নেই (আছে ৳${current})।`, 400);
    }
    const next = input.type === 'credit' ? current + amount : current - amount;
    const status = next <= 0 ? 'redeemed' : 'active';

    const [updated] = await tx
      .update(giftCards)
      .set({ remainingAmount: String(next), status, updatedAt: new Date() })
      .where(eq(giftCards.id, card.id))
      .returning();

    const [entry] = await tx
      .insert(giftCardTransactions)
      .values({
        giftCardId: card.id,
        type: input.type === 'credit' ? 'adjust' : 'redeem',
        amount: String(input.type === 'credit' ? amount : -amount),
        balanceAfter: String(next),
        note: input.note ?? null,
        adminId: input.adminId ?? null,
        orderId: input.orderId ?? null,
      })
      .returning();

    return { card: serializeGiftCard(updated), transaction: entry, previousBalance: current };
  });
}

export async function giftCardLedger(cardId: number, dbc: DbClient = db) {
  const card = await cardByCodeOrId(dbc, cardId);
  const rows = await dbc
    .select()
    .from(giftCardTransactions)
    .where(eq(giftCardTransactions.giftCardId, cardId))
    .orderBy(desc(giftCardTransactions.createdAt));
  return {
    card: serializeGiftCard(card),
    transactions: rows.map((r) => ({
      id: r.id,
      type: r.type,
      amount: Number(r.amount),
      balanceAfter: Number(r.balanceAfter),
      note: r.note,
      orderId: r.orderId,
      adminId: r.adminId,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
