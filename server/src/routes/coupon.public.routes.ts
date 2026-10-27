import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { validateCoupon } from '../services/coupon.service';
import { optionalAuth, AuthRequest } from '../middleware/auth';

/** POST /api/coupons/validate — always re-computed on the server. */
const router = Router();

router.post(
  '/validate',
  optionalAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const code = String(req.body?.code ?? '');
    const subtotal = Math.max(0, Number(req.body?.orderAmount ?? req.body?.subtotal ?? 0));
    const result = await validateCoupon(code, subtotal, req.userId ?? null);
    return res.json({
      success: true,
      data: result,
      code: result.code,
      discountAmount: result.discount,
      freeShipping: result.freeShipping,
      message: result.freeShipping ? 'ফ্রি ডেলিভারি কুপন প্রয়োগ হয়েছে।' : `৳${result.discount} ডিসকাউন্ট প্রয়োগ হয়েছে।`,
    });
  })
);

export default router;
