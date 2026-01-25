import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, orderItems, userLoyaltyPoints, loyaltyPointsHistory, settings, products, productVariants, productInventory, stockMovements, user } from '@/lib/schema';
import { eq, or, and, isNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

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

// Get loyalty settings
async function getLoyaltySettings() {
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

    // Convert values based on the setting key
    if (setting.key === 'loyalty_enabled') {
      value = value === 'true';
    } else if (setting.key.includes('rate') || setting.key.includes('value') || setting.key.includes('minimum') || setting.key.includes('percent') || setting.key.includes('months')) {
      value = parseFloat(value) || 0;
    }

    settingsObj[setting.key] = value;
  });

  return {
    enabled: settingsObj.loyalty_enabled === true || settingsObj.loyalty_enabled === 'true',
    earningRate: Number(settingsObj.points_earning_rate) || 1,
    earningBasis: settingsObj.points_earning_basis || 'subtotal',
    redemptionValue: Number(settingsObj.points_redemption_value) || 0.01,
    expiryMonths: Number(settingsObj.points_expiry_months) || 12,
    minimumOrder: Number(settingsObj.points_minimum_order) || 0,
    maxRedemptionPercent: Number(settingsObj.points_max_redemption_percent) || 50,
    redemptionMinimum: Number(settingsObj.points_redemption_minimum) || 100
  };
}

// Award loyalty points for an order
async function awardLoyaltyPoints(userId: string, orderId: string, orderAmount: number, subtotal: number, orderStatus: string) {
  const settings = await getLoyaltySettings();

  if (!settings.enabled) {
    console.log('Loyalty program disabled, skipping points award');
    return;
  }

  // Calculate points based on earning basis
  const baseAmount = settings.earningBasis === 'total' ? orderAmount : subtotal;

  if (baseAmount < settings.minimumOrder) {
    console.log(`Order amount ${baseAmount} below minimum ${settings.minimumOrder}, skipping points award`);
    return;
  }

  const pointsToAward = Math.floor(baseAmount * settings.earningRate);

  if (pointsToAward <= 0) {
    console.log('No points to award');
    return;
  }

  // Calculate expiry date
  const expiresAt = settings.expiryMonths > 0
    ? new Date(Date.now() + (settings.expiryMonths * 30 * 24 * 60 * 60 * 1000))
    : null;

  // Check if user has loyalty points record
  const existingPoints = await db
    .select()
    .from(userLoyaltyPoints)
    .where(eq(userLoyaltyPoints.userId, userId))
    .limit(1);

  const status = orderStatus === 'completed' ? 'available' : 'pending';
  const newBalance = status === 'available'
    ? (existingPoints[0]?.availablePoints || 0) + pointsToAward
    : (existingPoints[0]?.availablePoints || 0);

  if (existingPoints.length > 0) {
    // Update existing record
    await db.update(userLoyaltyPoints)
      .set({
        totalPointsEarned: (existingPoints[0].totalPointsEarned || 0) + pointsToAward,
        availablePoints: newBalance,
        lastEarnedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(userLoyaltyPoints.userId, userId));
  } else {
    // Create new record
    await db.insert(userLoyaltyPoints).values({
      id: uuidv4(),
      userId,
      totalPointsEarned: pointsToAward,
      totalPointsRedeemed: 0,
      availablePoints: newBalance,
      lastEarnedAt: new Date(),
      lastRedeemedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  // Add history record
  await db.insert(loyaltyPointsHistory).values({
    id: uuidv4(),
    userId,
    orderId,
    transactionType: 'earned',
    status,
    points: pointsToAward,
    pointsBalance: newBalance,
    description: `Earned from order #${orderId}`,
    orderAmount: orderAmount.toString(),
    discountAmount: null,
    expiresAt,
    isExpired: false,
    processedBy: null,
    metadata: {
      earningRate: settings.earningRate,
      earningBasis: settings.earningBasis,
      orderAmount,
      subtotal
    },
    createdAt: new Date()
  });

  console.log(`Awarded ${pointsToAward} points to user ${userId} for order ${orderId} (status: ${status})`);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      items,
      total,
      subtotal,
      paymentMethod = 'cod',
      deliveryAddress,
      orderNotes,
      pointsRedeemed = 0,
      pointsDiscount = 0
    } = body;

    // Validate required fields
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Order items are required' }, { status: 400 });
    }

    if (!subtotal || !total) {
      return NextResponse.json({ error: 'Subtotal and total amount are required' }, { status: 400 });
    }

    // Generate order number (matching admin logic)
    const orderNumber = 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5).toUpperCase();
    const orderId = uuidv4();

    // Check if stock management is enabled
    const stockManagementEnabled = await getStockManagementSettingDirect();

    // Validate inventory for all items before creating order (only if stock management is enabled)
    if (stockManagementEnabled) {
      for (const item of items) {
        const productId = item.product?.id || item.id;
        const variantId = item.variantId || item.product?.variantId || null;
        const quantity = item.quantity || 1;
        const numericValue = item.numericValue; // Weight in grams for weight-based products

        // Get product details to determine stock management type
        const productDetails = await db.query.products.findFirst({
          where: eq(products.id, productId),
          columns: { stockManagementType: true, productType: true }
        });

        if (!productDetails) {
          return NextResponse.json({
            error: `Product not found: ${item.product?.name || item.name}`
          }, { status: 400 });
        }

        const isWeightBased = productDetails.stockManagementType === 'weight';
        const isWeightBasedVariable = isWeightBased && productDetails.productType === 'variable';

        // For weight-based variable products, ALWAYS check inventory at product level (variantId = null)
        // For other products, use the provided variantId
        const inventoryLookupVariantId = isWeightBasedVariable ? null : variantId;

        // Check inventory for this product/variant
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

        if (inventory.length === 0) {
          return NextResponse.json({
            error: `No inventory record found for ${item.product?.name || item.name}`
          }, { status: 400 });
        }

        // Check available stock based on stock management type
        if (isWeightBased) {
          const availableWeight = parseFloat(inventory[0].availableWeight || '0');
          const requestedWeight = numericValue || quantity;

          if (availableWeight < requestedWeight) {
            return NextResponse.json({
              error: `Insufficient stock for ${item.product?.name || item.name}. Available: ${availableWeight}g, Requested: ${requestedWeight}g`
            }, { status: 400 });
          }
        } else {
          const availableQuantity = inventory[0].availableQuantity || 0;
          if (availableQuantity < quantity) {
            return NextResponse.json({
              error: `Insufficient stock for ${item.product?.name || item.name}. Available: ${availableQuantity}, Requested: ${quantity}`
            }, { status: 400 });
          }
        }
      }
    }

    // Get user email for order  
    const userQuery = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    const userEmail = userQuery[0]?.email || session.user.email || '';

    // Create the order
    await db.insert(orders).values({
      id: orderId,
      orderNumber,
      userId: session.user.id,
      email: userEmail,
      phone: null,
      status: 'pending',
      paymentStatus: 'pending',
      fulfillmentStatus: 'pending',
      subtotal: subtotal.toString(),
      taxAmount: ((total || 0) - (subtotal || 0)).toString(),
      shippingAmount: '0.00',
      discountAmount: '0.00',
      totalAmount: total.toString(),
      currency: 'USD',

      // Driver assignment fields
      assignedDriverId: null,
      deliveryStatus: 'pending',

      // Loyalty points fields
      pointsToRedeem: pointsRedeemed || 0,
      pointsDiscountAmount: pointsDiscount.toString(),

      // Billing address (same as shipping for now)
      billingFirstName: session.user.name?.split(' ')[0] || null,
      billingLastName: session.user.name?.split(' ').slice(1).join(' ') || null,
      billingAddress1: deliveryAddress?.street || null,
      billingCity: deliveryAddress?.city || null,
      billingState: deliveryAddress?.state || null,
      billingPostalCode: deliveryAddress?.zipCode || null,
      billingCountry: 'US',

      // Shipping address
      shippingFirstName: session.user.name?.split(' ')[0] || null,
      shippingLastName: session.user.name?.split(' ').slice(1).join(' ') || null,
      shippingAddress1: deliveryAddress?.street || null,
      shippingCity: deliveryAddress?.city || null,
      shippingState: deliveryAddress?.state || null,
      shippingPostalCode: deliveryAddress?.zipCode || null,
      shippingCountry: 'US',

      notes: orderNotes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create order items and manage inventory
    for (const item of items) {
      const orderItemId = uuidv4();
      const productId = item.product?.id || item.id;
      const productName = item.product?.name || item.name;
      const quantity = item.quantity || 1;
      const numericValue = item.numericValue; // Weight in grams for weight-based products
      const price = item.product?.price || item.price || 0;

      console.log(`Processing order item: ${productName}, quantity: ${quantity}, numericValue: ${numericValue}, item:`, item);

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
      if (item.product?.selectedAttributes || item.addons) {
        addonData = {
          selectedAttributes: item.product?.selectedAttributes || {},
          variantSku: item.product?.variantSku || null,
          addons: item.addons || []
        };
      }

      // Create order item
      await db.insert(orderItems).values({
        id: orderItemId,
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
        addons: addonData ? JSON.stringify(addonData) : null,
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
          // For other products, use the provided variantId
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
              const requestedWeight = numericValue || quantity;

              console.log(`Weight-based deduction for ${productName}:`, {
                quantity,
                numericValue,
                requestedWeight,
                currentWeightQuantity,
                isWeightBasedVariable,
                inventoryLookupVariantId
              });

              const newWeightQuantity = currentWeightQuantity - requestedWeight;
              const newAvailableWeight = newWeightQuantity - currentReservedWeight;

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

    // Get created order for response
    const createdOrder = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    // Get created items for response
    const createdItems = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    // Award loyalty points
    if (session.user.id) {
      console.log(`\n=== LOYALTY POINTS PROCESSING ===`);
      console.log(`Order: ${orderNumber}, UserId: ${session.user.id}, Status: pending`);
      console.log(`Total: ${total}, Subtotal: ${subtotal}`);
      try {
        await awardLoyaltyPoints(session.user.id, orderId, total, subtotal, 'pending');
        console.log(`✅ Successfully processed points for user ${session.user.id} for order ${orderNumber}`);
      } catch (pointsError) {
        console.error('❌ Error awarding loyalty points:', pointsError);
        // Don't fail the order creation if points awarding fails
      }
      console.log(`=== END LOYALTY POINTS PROCESSING ===\n`);
    }

    return NextResponse.json({
      ...createdOrder[0],
      items: createdItems,
      orderId: orderId,
      orderNumber: orderNumber
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}