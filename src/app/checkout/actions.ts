'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { userLoyaltyPoints, loyaltyPointsHistory, settings, orders, orderItems, user, products, productVariants, productInventory, stockMovements, couponRedemptions } from '@/lib/schema'
import { eq, and, or, isNull } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { validateAndCalculateCouponDiscount } from '@/lib/coupons'
import { sendAdminOrderNotification } from '@/lib/email'

// Get loyalty settings directly from database
export async function getLoyaltySettings() {
  try {
    if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASS || !process.env.DB_NAME) {
      console.log('Database not configured, using default loyalty settings');
      return {
        enabled: true,
        earningRate: 1,
        earningBasis: 'subtotal',
        redemptionValue: 0.01,
        expiryMonths: 12,
        minimumOrder: 0,
        maxRedemptionPercent: 50,
        redemptionMinimum: 100
      };
    }

    const loyaltySettings = await db
      .select()
      .from(settings)
      .where(
        or(
          eq(settings.key, 'loyalty_enabled'),
          eq(settings.key, 'points_earning_rate'),
          eq(settings.key, 'points_earning_basis'),
          eq(settings.key, 'points_redemption_value'),
          eq(settings.key, 'points_expiry_months'),
          eq(settings.key, 'points_minimum_order'),
          eq(settings.key, 'points_max_redemption_percent'),
          eq(settings.key, 'points_redemption_minimum')
        )
      );

    const settingsObj: { [key: string]: any } = {};
    loyaltySettings.forEach(setting => {
      let value: any = setting.value;

      if (setting.key === 'loyalty_enabled') {
        value = value === 'true';
      } else if (setting.key.includes('rate') || setting.key.includes('value') || setting.key.includes('minimum') || setting.key.includes('percent') || setting.key.includes('months')) {
        value = parseFloat(value) || 0;
      }

      settingsObj[setting.key] = value;
    });

    return {
      enabled: settingsObj.loyalty_enabled === true,
      earningRate: Number(settingsObj.points_earning_rate) || 1,
      earningBasis: settingsObj.points_earning_basis || 'subtotal',
      redemptionValue: Number(settingsObj.points_redemption_value) || 0.01,
      expiryMonths: Number(settingsObj.points_expiry_months) || 12,
      minimumOrder: Number(settingsObj.points_minimum_order) || 0,
      maxRedemptionPercent: Number(settingsObj.points_max_redemption_percent) || 50,
      redemptionMinimum: Number(settingsObj.points_redemption_minimum) || 100
    };
  } catch (error) {
    console.error('Error fetching loyalty settings:', error);
    return {
      enabled: true,
      earningRate: 1,
      earningBasis: 'subtotal',
      redemptionValue: 0.01,
      expiryMonths: 12,
      minimumOrder: 0,
      maxRedemptionPercent: 50,
      redemptionMinimum: 100
    };
  }
}

// Get stock management setting
async function getStockManagementSettingDirect() {
  try {
    const setting = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'stock_management_enabled'))
      .limit(1);

    return setting.length > 0 ? setting[0].value === 'true' : false;
  } catch (error) {
    console.error('Error fetching stock management setting:', error);
    return false;
  }
}

// Get customer points directly from database
export async function getCustomerPoints(userId: string) {
  try {
    if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASS || !process.env.DB_NAME) {
      return {
        availablePoints: 0,
        totalPointsEarned: 0,
        totalPointsRedeemed: 0
      };
    }

    const userPoints = await db
      .select()
      .from(userLoyaltyPoints)
      .where(eq(userLoyaltyPoints.userId, userId))
      .limit(1);

    if (userPoints.length === 0) {
      return {
        availablePoints: 0,
        totalPointsEarned: 0,
        totalPointsRedeemed: 0
      };
    }

    const points = userPoints[0];
    return {
      availablePoints: points.availablePoints || 0,
      totalPointsEarned: points.totalPointsEarned || 0,
      totalPointsRedeemed: points.totalPointsRedeemed || 0
    };
  } catch (error) {
    console.error('Error fetching customer points:', error);
    return {
      availablePoints: 0,
      totalPointsEarned: 0,
      totalPointsRedeemed: 0
    };
  }
}

// Process checkout with direct database operations
export async function processCheckout(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new Error('User not authenticated');
    }

    // Parse form data
    const orderTypeFromForm = formData.get('orderType') as string;
    const checkoutData = {
      items: JSON.parse(formData.get('items') as string),
      total: parseFloat(formData.get('total') as string),
      subtotal: parseFloat(formData.get('subtotal') as string),
      deliveryFee: parseFloat(formData.get('deliveryFee') as string || '0'),
      shippingFee: parseFloat(formData.get('shippingFee') as string || '0'),
      paymentMethod: formData.get('paymentMethod') as string,
      orderType: orderTypeFromForm || 'delivery',
      customerInfo: JSON.parse(formData.get('customerInfo') as string),
      deliveryAddress: formData.get('deliveryAddress') ? JSON.parse(formData.get('deliveryAddress') as string) : null,
      pickupLocationId: formData.get('pickupLocationId') as string || null,
      orderNotes: formData.get('orderNotes') as string || '',
      pointsToRedeem: parseInt(formData.get('pointsToRedeem') as string || '0'),
      pointsDiscountAmount: parseFloat(formData.get('pointsDiscountAmount') as string || '0'),
      couponCode: formData.get('couponCode') as string || '',
    };

    console.log('📦 Order Type from form:', orderTypeFromForm);
    console.log('📦 Order Type in checkoutData:', checkoutData.orderType);

    // Validate order type
    if (!['delivery', 'pickup', 'shipping'].includes(checkoutData.orderType)) {
      console.error('⚠️ Invalid order type received:', checkoutData.orderType);
      throw new Error(`Invalid order type: ${checkoutData.orderType}`);
    }

    const orderId = uuidv4();
    const orderNumber = `ORD-${Date.now()}`;
    // Coupon: validate and compute on server (do not trust client).
    const couponResult = checkoutData.couponCode
      ? await validateAndCalculateCouponDiscount({
          code: checkoutData.couponCode,
          itemsSubtotal: checkoutData.subtotal,
        })
      : null;

    const couponIdToSave = couponResult && couponResult.ok ? couponResult.coupon.id : null;
    const couponCodeToSave = couponResult && couponResult.ok ? couponResult.normalizedCode : null;
    const couponDiscountAmountToSave = couponResult && couponResult.ok ? couponResult.discountAmount : 0;

    // Points apply after coupon (frontend enforces; backend clamps to never exceed remaining subtotal).
    const loyaltySettings = await getLoyaltySettings();
    const pointsEligibleSubtotal = Math.max(0, checkoutData.subtotal - couponDiscountAmountToSave);
    const maxPointsDiscount = pointsEligibleSubtotal * (loyaltySettings.maxRedemptionPercent / 100);
    let pointsToRedeem = Math.max(0, Number.isFinite(checkoutData.pointsToRedeem) ? checkoutData.pointsToRedeem : 0);
    let pointsDiscountAmount = Math.max(0, Number.isFinite(checkoutData.pointsDiscountAmount) ? checkoutData.pointsDiscountAmount : 0);

    // Recompute points discount from pointsToRedeem when possible.
    if (loyaltySettings.enabled && loyaltySettings.redemptionValue > 0 && pointsToRedeem > 0) {
      pointsDiscountAmount = pointsToRedeem * loyaltySettings.redemptionValue;
      pointsDiscountAmount = Math.min(pointsDiscountAmount, maxPointsDiscount, pointsEligibleSubtotal);
      pointsToRedeem = Math.floor(pointsDiscountAmount / loyaltySettings.redemptionValue);
    } else {
      pointsToRedeem = 0;
      pointsDiscountAmount = 0;
    }

    const fees = (checkoutData.deliveryFee || 0) + (checkoutData.shippingFee || 0);
    const finalTotal = Math.max(
      0,
      checkoutData.subtotal + fees - couponDiscountAmountToSave - pointsDiscountAmount
    );

    // Check if database is configured
    if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASS || !process.env.DB_NAME) {
      console.log('⚠️ Database not configured - order cannot be processed');
      throw new Error('Database not configured');
    }

    // Get order settings to validate minimum order value
    const orderSettings = await getOrderSettings();
    if (checkoutData.subtotal < orderSettings.minimumOrderValue) {
      throw new Error(`Minimum order value is $${orderSettings.minimumOrderValue.toFixed(2)}. Current order: $${checkoutData.subtotal.toFixed(2)}`);
    }

    // Redeem points if any
    if (pointsToRedeem > 0) {
      console.log(`\n=== POINTS REDEMPTION ===`);
      console.log(`User: ${session.user.id}, Points to redeem: ${pointsToRedeem}, Discount: $${pointsDiscountAmount}`);

      // Get current points
      const userPoints = await db
        .select()
        .from(userLoyaltyPoints)
        .where(eq(userLoyaltyPoints.userId, session.user.id))
        .limit(1);

      if (userPoints.length === 0 || (userPoints[0].availablePoints || 0) < pointsToRedeem) {
        throw new Error('Insufficient points for redemption');
      }

      const currentPoints = userPoints[0];
      const newAvailablePoints = (currentPoints.availablePoints || 0) - pointsToRedeem;
      const newTotalRedeemed = (currentPoints.totalPointsRedeemed || 0) + pointsToRedeem;

      // Update user points
      await db.update(userLoyaltyPoints)
        .set({
          availablePoints: newAvailablePoints,
          totalPointsRedeemed: newTotalRedeemed,
          lastRedeemedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(userLoyaltyPoints.userId, session.user.id));

      // Add redemption history
      await db.insert(loyaltyPointsHistory).values({
        id: uuidv4(),
        userId: session.user.id,
        orderId,
        transactionType: 'redeemed',
        status: 'available',
        points: -pointsToRedeem,
        pointsBalance: newAvailablePoints,
        description: `Redeemed ${pointsToRedeem} points for $${pointsDiscountAmount.toFixed(2)} discount`,
        orderAmount: finalTotal.toString(),
        discountAmount: pointsDiscountAmount.toString(),
        expiresAt: null,
        isExpired: false,
        processedBy: session.user.id,
        metadata: { source: 'checkout_redemption' },
        createdAt: new Date(),
      });

      console.log(`✅ Points redeemed successfully. New balance: ${newAvailablePoints}`);
    }

    // Create order
    console.log(`\n=== ORDER CREATION ===`);
    console.log(`Order: ${orderNumber}, Total: $${finalTotal}, User: ${session.user.id}`);
    console.log(`Order Type being saved: ${checkoutData.orderType}`);

    await db.insert(orders).values({
      id: orderId,
      orderNumber,
      userId: session.user.id,
      email: checkoutData.customerInfo.email || '',
      phone: checkoutData.customerInfo.phone || null,
      status: 'pending',
      paymentStatus: 'pending',
      fulfillmentStatus: 'pending',
      subtotal: checkoutData.subtotal.toString(),
      taxAmount: '0.00',
      shippingAmount: (checkoutData.deliveryFee + checkoutData.shippingFee).toString(), // Only one will be non-zero based on order type
      discountAmount: pointsDiscountAmount.toString(),
      totalAmount: finalTotal.toString(),
      currency: 'USD',

      // Order type and pickup location fields
      orderType: checkoutData.orderType, // Remove the || 'delivery' fallback to see actual value
      pickupLocationId: checkoutData.pickupLocationId || null,

      // Driver assignment fields
      assignedDriverId: null,
      deliveryStatus: 'pending',

      // Loyalty points fields
      pointsToRedeem: pointsToRedeem,
      pointsDiscountAmount: pointsDiscountAmount.toString(),

      // Coupon fields
      couponId: couponIdToSave,
      couponCode: couponCodeToSave,
      couponDiscountAmount: couponDiscountAmountToSave.toString(),

      // Addresses (for delivery and shipping orders)
      billingFirstName: checkoutData.customerInfo.name?.split(' ')[0] || null,
      billingLastName: checkoutData.customerInfo.name?.split(' ').slice(1).join(' ') || null,
      billingAddress1: checkoutData.deliveryAddress?.street || null,
      billingCity: checkoutData.deliveryAddress?.city || null,
      billingState: checkoutData.deliveryAddress?.state || null,
      billingPostalCode: checkoutData.deliveryAddress?.zipCode || null,
      billingCountry: 'US',

      shippingFirstName: checkoutData.customerInfo.name?.split(' ')[0] || null,
      shippingLastName: checkoutData.customerInfo.name?.split(' ').slice(1).join(' ') || null,
      shippingAddress1: checkoutData.deliveryAddress?.street || null,
      shippingCity: checkoutData.deliveryAddress?.city || null,
      shippingState: checkoutData.deliveryAddress?.state || null,
      shippingPostalCode: checkoutData.deliveryAddress?.zipCode || null,
      shippingCountry: 'US',
      shippingLatitude: checkoutData.deliveryAddress?.latitude || null,
      shippingLongitude: checkoutData.deliveryAddress?.longitude || null,

      notes: checkoutData.orderNotes || null,
      deliveryInstructions: checkoutData.deliveryAddress?.instructions || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Record coupon redemption for reporting.
    if (couponIdToSave && couponCodeToSave && couponDiscountAmountToSave > 0) {
      await db.insert(couponRedemptions).values({
        id: uuidv4(),
        couponId: couponIdToSave,
        orderId,
        userId: session.user.id,
        email: checkoutData.customerInfo.email || null,
        codeSnapshot: couponCodeToSave,
        discountAmount: couponDiscountAmountToSave.toString(),
        redeemedAt: new Date(),
      });
    }

    console.log(`✅ Order created with type: ${checkoutData.orderType}`);

    // Verify what was saved by reading it back
    const savedOrder = await db
      .select({ orderType: orders.orderType })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (savedOrder.length > 0) {
      console.log(`✅ Verified order_type in database: ${savedOrder[0].orderType}`);
      if (savedOrder[0].orderType !== checkoutData.orderType) {
        console.error(`🚨 ORDER TYPE MISMATCH! Expected: ${checkoutData.orderType}, Got: ${savedOrder[0].orderType}`);
      }
    }

    // Check if stock management is enabled
    const stockManagementEnabled = await getStockManagementSettingDirect();

    // Create order items and manage inventory
    for (const item of checkoutData.items) {
      console.log('=== PROCESSING CART ITEM ===');
      console.log('Full item:', JSON.stringify(item, null, 2));

      const productId = item.product?.id || item.id;
      const productName = item.product?.name || item.name;
      const quantity = item.quantity || 1;
      const numericValue = item.numericValue; // Weight in grams for weight-based products
      const price = item.product?.price || item.price || 0;

      console.log(`Product: ${productName}`);
      console.log(`Quantity: ${quantity}`);
      console.log(`numericValue: ${numericValue}`);
      console.log(`Has numericValue: ${numericValue !== undefined && numericValue !== null}`);

      // Get cost price and compare price from product or variant at time of sale
      let costPrice = null;
      let comparePrice = null;
      let totalCost = null;

      // Check both possible locations for variantId
      const variantId = item.variantId || item.product?.variantId;

      // Debug logging for variant detection
      console.log(`Checking variant for ${productName}:`, {
        itemVariantId: item.variantId,
        productVariantId: item.product?.variantId,
        finalVariantId: variantId,
        selectedAttributes: item.product?.selectedAttributes
      });

      try {
        if (variantId) {
          // Get cost price and compare price from variant
          const variant = await db.query.productVariants.findFirst({
            where: eq(productVariants.id, variantId),
            columns: { costPrice: true, comparePrice: true }
          });
          if (variant?.costPrice) {
            costPrice = parseFloat(variant.costPrice.toString());
          }
          if (variant?.comparePrice) {
            comparePrice = parseFloat(variant.comparePrice.toString());
          }
        } else {
          // Get cost price and compare price from product
          const product = await db.query.products.findFirst({
            where: eq(products.id, productId),
            columns: { costPrice: true, comparePrice: true }
          });
          if (product?.costPrice) {
            costPrice = parseFloat(product.costPrice.toString());
          }
          if (product?.comparePrice) {
            comparePrice = parseFloat(product.comparePrice.toString());
          }
        }

        // Calculate total cost
        if (costPrice) {
          totalCost = costPrice * quantity;
        }

        // Debug logging
        console.log(`Order item pricing for ${productName}:`, {
          productId,
          variantId: variantId,
          price,
          costPrice,
          comparePrice,
          totalCost
        });
      } catch (error) {
        console.warn(`Failed to get cost price and compare price for item ${productName}:`, error);
      }

      // Prepare variation attributes for storage
      let addonData = null;
      const itemNote = typeof item.note === 'string' ? item.note.trim() : '';
      const noteToSave = itemNote.length > 0 ? itemNote : null;

      if (item.product?.selectedAttributes || item.addons || noteToSave) {
        addonData = {
          selectedAttributes: item.product?.selectedAttributes || {},
          variantSku: item.product?.variantSku || null,
          addons: item.addons || [],
          note: noteToSave
        };
      }

      await db.insert(orderItems).values({
        id: uuidv4(),
        orderId,
        productId,
        variantId: variantId || null,
        productName,
        variantTitle: item.variantTitle || null,
        sku: item.sku || item.product?.variantSku || null,
        quantity,
        price: price.toString(),
        costPrice: costPrice?.toString() || null,
        comparePrice: comparePrice?.toString() || null,
        totalPrice: (price * quantity).toString(),
        totalCost: totalCost?.toString() || null,
        productImage: item.product?.images?.[0] || item.product?.image || null,
        addons: addonData || null,
        createdAt: new Date(),
      });

      // Update inventory if stock management is enabled
      if (stockManagementEnabled) {
        try {
          // Get product to determine stock management type
          const productDetails = await db.query.products.findFirst({
            where: eq(products.id, productId),
            columns: { stockManagementType: true, productType: true }
          });

          if (!productDetails) {
            console.warn(`Product not found for stock deduction: ${productName}`);
            continue;
          }

          const isWeightBased = productDetails.stockManagementType === 'weight';
          const isWeightBasedVariable = isWeightBased && productDetails.productType === 'variable';

          // For weight-based variable products, ALWAYS use product-level inventory (variantId = null)
          const inventoryLookupVariantId = isWeightBasedVariable ? null : variantId;

          console.log(`Inventory lookup for ${productName}:`, {
            productType: productDetails.productType,
            stockManagementType: productDetails.stockManagementType,
            isWeightBasedVariable,
            originalVariantId: variantId,
            inventoryLookupVariantId
          });

          // Find inventory record
          const inventory = await db
            .select()
            .from(productInventory)
            .where(
              inventoryLookupVariantId
                ? and(
                  eq(productInventory.productId, productId),
                  eq(productInventory.variantId, inventoryLookupVariantId)
                )!
                : and(
                  eq(productInventory.productId, productId),
                  isNull(productInventory.variantId)
                )!
            )
            .limit(1);

          if (inventory.length > 0) {
            const currentInventory = inventory[0];

            if (isWeightBased) {
              // Handle weight-based stock deduction
              const currentWeightQuantity = parseFloat(currentInventory.weightQuantity || '0');
              const currentReservedWeight = parseFloat(currentInventory.reservedWeight || '0');
              // Use numericValue for weight-based products (e.g., 100g, 250g, 500g)
              // If numericValue is not available, fall back to quantity * some default
              console.log('=== BEFORE CALCULATING requestedWeight ===');
              console.log('numericValue type:', typeof numericValue);
              console.log('numericValue value:', numericValue);
              console.log('quantity type:', typeof quantity);
              console.log('quantity value:', quantity);

              const requestedWeight = numericValue || quantity;

              console.log('=== WEIGHT-BASED DEDUCTION ===');
              console.log(`Product: ${productName}`);
              console.log(`quantity: ${quantity}`);
              console.log(`numericValue: ${numericValue}`);
              console.log(`requestedWeight (will deduct): ${requestedWeight}g`);
              console.log(`currentWeightQuantity: ${currentWeightQuantity}g`);
              console.log(`isWeightBasedVariable: ${isWeightBasedVariable}`);
              console.log(`inventoryLookupVariantId: ${inventoryLookupVariantId}`);

              // Alert to show what we're about to deduct
              if (!numericValue) {
                console.error('⚠️ WARNING: numericValue is missing! Using quantity instead:', quantity);
              } else {
                console.log(`✓ Using numericValue: ${numericValue}g`);
              }

              const newWeightQuantity = currentWeightQuantity - requestedWeight;
              const newAvailableWeight = newWeightQuantity - currentReservedWeight;

              // Show deduction info
              console.log(`🔄 DEDUCTING FROM STOCK:\n\nProduct: ${productName}\nCurrent Stock: ${currentWeightQuantity}g\nWill Deduct: ${requestedWeight}g\nNew Stock: ${newWeightQuantity}g\n\nnumericValue from cart: ${numericValue || 'NOT SET'}\nUsing: ${requestedWeight}g`);

              // Update inventory
              await db
                .update(productInventory)
                .set({
                  weightQuantity: newWeightQuantity.toString(),
                  availableWeight: newAvailableWeight.toString(),
                  updatedAt: new Date(),
                })
                .where(eq(productInventory.id, currentInventory.id));

              // Create stock movement record
              // For weight-based variable products, variantId should be null
              await db.insert(stockMovements).values({
                id: uuidv4(),
                inventoryId: currentInventory.id,
                productId,
                variantId: isWeightBasedVariable ? null : (variantId || null),
                movementType: 'out',
                quantity: 0, // No quantity change for weight-based
                previousQuantity: currentInventory.quantity || 0,
                newQuantity: currentInventory.quantity || 0,
                weightQuantity: requestedWeight.toString(),
                previousWeightQuantity: currentWeightQuantity.toString(),
                newWeightQuantity: newWeightQuantity.toString(),
                reason: 'Order fulfillment',
                reference: orderNumber,
                notes: `Sold ${requestedWeight}g for order ${orderNumber}${isWeightBasedVariable ? ' (product-level inventory)' : ''}`,
                costPrice: costPrice?.toString() || null,
                processedBy: session.user.id,
                createdAt: new Date(),
              });
            } else {
              // Handle quantity-based stock deduction
              const currentReservedQuantity = currentInventory.reservedQuantity || 0;
              const newQuantity = (currentInventory.quantity || 0) - quantity;
              const newAvailableQuantity = newQuantity - currentReservedQuantity;

              // Update inventory
              await db.update(productInventory)
                .set({
                  quantity: Math.max(0, newQuantity),
                  availableQuantity: Math.max(0, newAvailableQuantity),
                  updatedAt: new Date()
                })
                .where(eq(productInventory.id, currentInventory.id));

              // Create stock movement record
              await db.insert(stockMovements).values({
                id: uuidv4(),
                inventoryId: currentInventory.id,
                productId,
                variantId: variantId || null,
                movementType: 'out',
                quantity: quantity,
                previousQuantity: currentInventory.quantity || 0,
                newQuantity: Math.max(0, newQuantity),
                weightQuantity: '0.00',
                previousWeightQuantity: '0.00',
                newWeightQuantity: '0.00',
                reason: 'Order fulfillment',
                reference: orderNumber,
                notes: `Sold ${quantity} units for order ${orderNumber}`,
                costPrice: costPrice?.toString() || null,
                processedBy: session.user.id,
                createdAt: new Date(),
              });
            }
          }
        } catch (inventoryError) {
          console.error(`Error updating inventory for ${productName}:`, inventoryError);
          // Continue with order creation even if inventory update fails
        }
      }
    }

    // Notify admin of order creation (do not block checkout if email fails)
    try {
      await sendAdminOrderNotification({
        orderNumber,
        orderType: checkoutData.orderType,
        total: finalTotal,
        itemCount: Array.isArray(checkoutData.items) ? checkoutData.items.length : 0,
        userId: session.user.id,
        customerName: checkoutData.customerInfo?.name || null,
        customerEmail: checkoutData.customerInfo?.email || null,
        customerPhone: checkoutData.customerInfo?.phone || null,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error('Error sending admin order notification:', error);
    }

    // Award loyalty points for the order
    if (loyaltySettings.enabled) {
      console.log(`\n=== LOYALTY POINTS EARNING ===`);
      console.log(`Settings: Rate=${loyaltySettings.earningRate}, Basis=${loyaltySettings.earningBasis}`);

      // Calculate points based on original behavior (before fees were added)
      // Originally: total = subtotal + tax (where tax was 0), so total === subtotal
      const originalTotal = checkoutData.subtotal; // This maintains the original behavior
      const baseAmount = loyaltySettings.earningBasis === 'total' ? originalTotal : checkoutData.subtotal;
      const pointsToAward = Math.floor(baseAmount * loyaltySettings.earningRate);

      if (pointsToAward > 0 && baseAmount >= loyaltySettings.minimumOrder) {
        // Get or create user loyalty points record
        const existingPoints = await db
          .select()
          .from(userLoyaltyPoints)
          .where(eq(userLoyaltyPoints.userId, session.user.id))
          .limit(1);

        const status = 'pending'; // Pointssss become available when order is completed
        const currentBalance = existingPoints[0]?.availablePoints || 0;

        if (existingPoints.length > 0) {
          await db.update(userLoyaltyPoints)
            .set({
              totalPointsEarned: (existingPoints[0].totalPointsEarned || 0) + pointsToAward,
              pendingPoints: (existingPoints[0].pendingPoints || 0) + pointsToAward, // Add to pending points
              lastEarnedAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(userLoyaltyPoints.userId, session.user.id));
        } else {
          await db.insert(userLoyaltyPoints).values({
            id: uuidv4(),
            userId: session.user.id,
            totalPointsEarned: pointsToAward,
            totalPointsRedeemed: 0,
            availablePoints: 0, // Will be updated when order is completed
            pendingPoints: pointsToAward, // Set pending points for new orders
            lastEarnedAt: new Date(),
            lastRedeemedAt: null,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }

        // Add earning history
        const expiresAt = loyaltySettings.expiryMonths > 0
          ? new Date(Date.now() + (loyaltySettings.expiryMonths * 30 * 24 * 60 * 60 * 1000))
          : null;

        await db.insert(loyaltyPointsHistory).values({
          id: uuidv4(),
          userId: session.user.id,
          orderId,
          transactionType: 'earned',
          status,
          points: pointsToAward,
          pointsBalance: currentBalance, // Will be updated when order is completed
          description: `Earned from order #${orderNumber}`,
          orderAmount: finalTotal.toString(),
          discountAmount: null,
          expiresAt,
          isExpired: false,
          processedBy: null,
          metadata: {
            source: 'order_checkout',
            earningRate: loyaltySettings.earningRate,
            earningBasis: loyaltySettings.earningBasis
          },
          createdAt: new Date(),
        });

        console.log(`✅ Awarded ${pointsToAward} points (pending) for order ${orderNumber}`);
      } else {
        console.log(`⚠️ No points awarded: Amount=${baseAmount}, MinOrder=${loyaltySettings.minimumOrder}, Points=${pointsToAward}`);
      }
    }

    console.log(`✅ Order ${orderNumber} created successfully`);

    // Update user table with checkout information for future auto-fill
    try {
      console.log(`\n=== UPDATING USER PROFILE ===`);
      console.log(`Updating user ${session.user.id} with checkout data`);

      await db.update(user)
        .set({
          name: checkoutData.customerInfo.name || undefined,
          email: checkoutData.customerInfo.email || undefined,
          phone: checkoutData.customerInfo.phone || undefined,
          address: checkoutData.deliveryAddress?.street || undefined,
          city: checkoutData.deliveryAddress?.city || undefined,
          state: checkoutData.deliveryAddress?.state || undefined,
          postalCode: checkoutData.deliveryAddress?.zipCode || undefined,
          latitude: checkoutData.deliveryAddress?.latitude || undefined,
          longitude: checkoutData.deliveryAddress?.longitude || undefined,
          updatedAt: new Date()
        })
        .where(eq(user.id, session.user.id));

      console.log(`✅ User profile updated successfully`);
    } catch (error) {
      console.error('Error updating user profile:', error);
      // Don't throw error here - order was successful, profile update is secondary
    }

    console.log(`=== END ORDER PROCESSING ===\n`);

    // Return success response
    return {
      success: true,
      orderId,
      orderNumber,
      total: finalTotal,
      pointsEarned: loyaltySettings.enabled ? Math.floor(checkoutData.subtotal * loyaltySettings.earningRate) : 0
    };

  } catch (error) {
    console.error('Checkout processing error:', error);
    throw error;
  }
}

// Get order settings directly from database
export async function getOrderSettings() {
  try {
    if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASS || !process.env.DB_NAME) {
      console.log('Database not configured, using default order settings');
      return {
        minimumOrderValue: 0,
        deliveryFee: 0,
        shippingFee: 0
      };
    }

    const orderSettings = await db
      .select()
      .from(settings)
      .where(
        or(
          eq(settings.key, 'order_minimum_order_value'),
          eq(settings.key, 'order_delivery_fee'),
          eq(settings.key, 'order_shipping_fee')
        )
      );

    const settingsObj: { [key: string]: any } = {};
    orderSettings.forEach(setting => {
      let value: any = setting.value;

      // Parse numeric values
      if (setting.type === 'number' || setting.key.includes('fee') || setting.key.includes('value')) {
        value = parseFloat(value) || 0;
      }

      settingsObj[setting.key] = value;
    });

    return {
      minimumOrderValue: Number(settingsObj.order_minimum_order_value) || 0,
      deliveryFee: Number(settingsObj.order_delivery_fee) || 0,
      shippingFee: Number(settingsObj.order_shipping_fee) || 0
    };
  } catch (error) {
    console.error('Error fetching order settings:', error);
    return {
      minimumOrderValue: 0,
      deliveryFee: 0,
      shippingFee: 0
    };
  }
}

// Get delivery status directly from database
export async function getDeliveryStatus() {
  try {
    if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASS || !process.env.DB_NAME) {
      console.log('Database not configured, assuming delivery is disabled for safety');
      return {
        enabled: false,
        message: 'Delivery is currently unavailable. Please contact support.',
        timestamp: new Date().toISOString()
      };
    }

    // Get delivery settings from database
    const deliverySettings = await db
      .select()
      .from(settings)
      .where(
        or(
          eq(settings.key, 'delivery_enabled'),
          eq(settings.key, 'delivery_message')
        )
      );

    let deliveryEnabled = false; // Default to disabled for safety
    let customMessage = 'Delivery is currently unavailable.';

    // Parse existing settings
    deliverySettings.forEach(setting => {
      if (setting.key === 'delivery_enabled') {
        try {
          deliveryEnabled = setting.value === 'true';
        } catch (error) {
          console.error('Error parsing delivery enabled setting:', error);
        }
      } else if (setting.key === 'delivery_message') {
        customMessage = setting.value || customMessage;
      }
    });

    return {
      enabled: deliveryEnabled,
      message: customMessage,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching delivery status from database:', error);
    // Return disabled state in case of error for safety
    return {
      enabled: false,
      message: 'Delivery is currently unavailable due to a system error.',
      timestamp: new Date().toISOString()
    };
  }
}

// Get shipping status directly from database
export async function getShippingStatus() {
  try {
    if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASS || !process.env.DB_NAME) {
      console.log('Database not configured, assuming shipping is disabled for safety');
      return {
        enabled: false,
        message: 'Shipping is currently unavailable. Please contact support.',
        timestamp: new Date().toISOString()
      };
    }

    // Get shipping settings from database
    const shippingSettings = await db
      .select()
      .from(settings)
      .where(
        or(
          eq(settings.key, 'shipping_enabled'),
          eq(settings.key, 'shipping_message')
        )
      );

    let shippingEnabled = false; // Default to disabled for safety
    let customMessage = 'Shipping is currently unavailable.';

    // Parse existing settings
    shippingSettings.forEach(setting => {
      if (setting.key === 'shipping_enabled') {
        try {
          shippingEnabled = setting.value === 'true';
        } catch (error) {
          console.error('Error parsing shipping enabled setting:', error);
        }
      } else if (setting.key === 'shipping_message') {
        customMessage = setting.value || customMessage;
      }
    });

    return {
      enabled: shippingEnabled,
      message: customMessage,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching shipping status from database:', error);
    // Return disabled state in case of error for safety
    return {
      enabled: false,
      message: 'Shipping is currently unavailable due to a system error.',
      timestamp: new Date().toISOString()
    };
  }
}