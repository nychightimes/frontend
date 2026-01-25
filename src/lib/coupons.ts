import { db } from '@/lib/db';
import { coupons } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export type CouponDiscountType = 'percent' | 'fixed';

export function normalizeCouponCode(code: unknown): string {
  return String(code ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

function toNumber(value: unknown): number {
  const n = Number(String(value ?? ''));
  return Number.isFinite(n) ? n : 0;
}

export type CouponValidationErrorCode =
  | 'invalid_code'
  | 'inactive'
  | 'not_started'
  | 'expired'
  | 'min_subtotal';

export type CouponValidationResult =
  | {
      ok: true;
      normalizedCode: string;
      coupon: typeof coupons.$inferSelect;
      discountAmount: number;
      eligibleSubtotal: number;
    }
  | {
      ok: false;
      normalizedCode: string;
      errorCode: CouponValidationErrorCode;
      message: string;
    };

export async function validateAndCalculateCouponDiscount(args: {
  code: unknown;
  itemsSubtotal: number;
  now?: Date;
}): Promise<CouponValidationResult> {
  const normalizedCode = normalizeCouponCode(args.code);
  if (!normalizedCode) {
    return {
      ok: false,
      normalizedCode,
      errorCode: 'invalid_code',
      message: 'Enter a coupon code.',
    };
  }

  const itemsSubtotal = Math.max(0, Number.isFinite(args.itemsSubtotal) ? args.itemsSubtotal : 0);
  const now = args.now ?? new Date();

  const coupon = await db.query.coupons.findFirst({
    where: eq(coupons.code, normalizedCode),
  });

  if (!coupon) {
    return {
      ok: false,
      normalizedCode,
      errorCode: 'invalid_code',
      message: 'Invalid coupon code.',
    };
  }

  if (!coupon.isActive) {
    return {
      ok: false,
      normalizedCode,
      errorCode: 'inactive',
      message: 'This coupon is not active.',
    };
  }

  const startAt = coupon.startAt ? new Date(coupon.startAt as any) : null;
  const endAt = coupon.endAt ? new Date(coupon.endAt as any) : null;

  if (startAt && now.getTime() < startAt.getTime()) {
    return {
      ok: false,
      normalizedCode,
      errorCode: 'not_started',
      message: 'This coupon is not valid yet.',
    };
  }

  if (endAt && now.getTime() > endAt.getTime()) {
    return {
      ok: false,
      normalizedCode,
      errorCode: 'expired',
      message: 'This coupon has expired.',
    };
  }

  const minSubtotal = coupon.minSubtotal ? toNumber(coupon.minSubtotal) : 0;
  if (minSubtotal > 0 && itemsSubtotal < minSubtotal) {
    return {
      ok: false,
      normalizedCode,
      errorCode: 'min_subtotal',
      message: `Minimum subtotal is $${minSubtotal.toFixed(2)}.`,
    };
  }

  // v1 eligible subtotal = full items subtotal.
  const eligibleSubtotal = itemsSubtotal;

  const discountType = String(coupon.discountType) as CouponDiscountType;
  const discountValue = toNumber(coupon.discountValue);

  let discountAmount = 0;
  if (eligibleSubtotal > 0) {
    if (discountType === 'percent') {
      discountAmount = (eligibleSubtotal * discountValue) / 100;
      const maxDiscountAmount = coupon.maxDiscountAmount ? toNumber(coupon.maxDiscountAmount) : 0;
      if (maxDiscountAmount > 0) {
        discountAmount = Math.min(discountAmount, maxDiscountAmount);
      }
    } else if (discountType === 'fixed') {
      discountAmount = Math.min(discountValue, eligibleSubtotal);
    }
  }

  discountAmount = Math.max(0, Math.min(discountAmount, eligibleSubtotal));

  return {
    ok: true,
    normalizedCode,
    coupon,
    discountAmount,
    eligibleSubtotal,
  };
}
