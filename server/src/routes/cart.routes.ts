import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../config/db';
import { cart, products } from '../schemas/index';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { toProductDto } from '../services/product.service';
import { productImages } from '../schemas/index';

const router = Router();
router.use(authenticate);

const addSchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
  selectedVariant: z.string().trim().max(255).optional(),
});

const updateSchema = z.object({ quantity: z.coerce.number().int().min(0).max(99) });

async function serializeCart(userId: number) {
  const rows = await db.select().from(cart).where(eq(cart.userId, userId));
  const items = [];
  for (const row of rows) {
    const [product] = await db.select().from(products).where(eq(products.id, row.productId)).limit(1);
    if (!product) continue;
    const imgs = await db.select().from(productImages).where(eq(productImages.productId, product.id));
    const dto = toProductDto(product, imgs.map((i) => ({ imageUrl: i.imageUrl, isMain: i.isMain })), null, []);
    items.push({
      id: row.id,
      productId: row.productId,
      quantity: row.quantity,
      price: dto.effectivePrice,
      lineTotal: dto.effectivePrice * row.quantity,
      selectedVariant: row.selectedVariant,
      product: dto,
      available: product.isActive && product.stock >= row.quantity,
      stock: product.stock,
    });
  }
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  return { items, subtotal, itemCount: items.reduce((s, i) => s + i.quantity, 0) };
}

router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const data = await serializeCart(req.userId!);
    return res.json({ success: true, ...data, data: data.items });
  })
);

router.post(
  '/',
  validateBody(addSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { productId, quantity, selectedVariant } = req.body as z.infer<typeof addSchema>;
    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!product || !product.isActive) throw new AppError('পণ্যটি পাওয়া যায়নি।', 404);
    if (product.stock < quantity) throw new AppError(`স্টকে মাত্র ${product.stock} টি আছে।`, 400);

    const [existing] = await db
      .select()
      .from(cart)
      .where(and(eq(cart.userId, req.userId!), eq(cart.productId, productId)))
      .limit(1);

    if (existing) {
      const nextQty = Math.min(product.stock, existing.quantity + quantity);
      await db.update(cart).set({ quantity: nextQty, updatedAt: new Date() }).where(eq(cart.id, existing.id));
    } else {
      await db.insert(cart).values({
        userId: req.userId!,
        productId,
        quantity,
        selectedVariant: selectedVariant ?? null,
        price: String(product.salePrice ?? product.price),
      });
    }
    const data = await serializeCart(req.userId!);
    return res.status(201).json({ success: true, message: 'কার্টে যোগ করা হয়েছে।', ...data, data: data.items });
  })
);

router.put(
  '/:itemId',
  validateBody(updateSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const itemId = Number(req.params.itemId);
    const { quantity } = req.body as z.infer<typeof updateSchema>;
    const [item] = await db.select().from(cart).where(and(eq(cart.id, itemId), eq(cart.userId, req.userId!))).limit(1);
    if (!item) throw new AppError('কার্ট আইটেম পাওয়া যায়নি।', 404);

    if (quantity === 0) {
      await db.delete(cart).where(eq(cart.id, itemId));
    } else {
      const [product] = await db.select({ stock: products.stock }).from(products).where(eq(products.id, item.productId)).limit(1);
      if (!product || product.stock < quantity) throw new AppError(`স্টকে মাত্র ${product?.stock ?? 0} টি আছে।`, 400);
      await db.update(cart).set({ quantity, updatedAt: new Date() }).where(eq(cart.id, itemId));
    }
    const data = await serializeCart(req.userId!);
    return res.json({ success: true, ...data, data: data.items });
  })
);

router.delete(
  '/:itemId',
  asyncHandler(async (req: AuthRequest, res) => {
    const itemId = Number(req.params.itemId);
    await db.delete(cart).where(and(eq(cart.id, itemId), eq(cart.userId, req.userId!)));
    const data = await serializeCart(req.userId!);
    return res.json({ success: true, message: 'আইটেম সরানো হয়েছে।', ...data, data: data.items });
  })
);

router.delete(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    await db.delete(cart).where(eq(cart.userId, req.userId!));
    return res.json({ success: true, message: 'কার্ট খালি করা হয়েছে।', items: [], subtotal: 0, itemCount: 0 });
  })
);

export default router;
