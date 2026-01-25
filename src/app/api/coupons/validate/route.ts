import { NextRequest, NextResponse } from 'next/server';
import { validateAndCalculateCouponDiscount } from '@/lib/coupons';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const subtotalRaw = Number(body?.subtotal);
    const subtotal = Number.isFinite(subtotalRaw) ? subtotalRaw : 0;

    const result = await validateAndCalculateCouponDiscount({
      code: body?.code,
      itemsSubtotal: subtotal,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          code: result.normalizedCode,
          errorCode: result.errorCode,
          message: result.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      code: result.normalizedCode,
      couponId: result.coupon.id,
      discountAmount: result.discountAmount,
    });
  } catch (error) {
    console.error('Coupon validation error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to validate coupon' },
      { status: 500 }
    );
  }
}
