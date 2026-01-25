import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productInventory, products, settings, productVariants } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';

// Get stock management setting
async function getStockManagementSetting() {
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

// Check if product uses weight-based stock management
function isWeightBasedProduct(stockManagementType: string): boolean {
  return stockManagementType === 'weight';
}

export async function POST(req: NextRequest) {
  try {
    const { productId, variantId, requestedQuantity, requestedWeight } = await req.json();

    if (!productId) {
      return NextResponse.json({
        error: 'Product ID is required'
      }, { status: 400 });
    }

    // Check if stock management is enabled
    const stockManagementEnabled = await getStockManagementSetting();

    if (!stockManagementEnabled) {
      // If stock management is disabled, allow any quantity/weight
      return NextResponse.json({
        success: true,
        available: true,
        stockManagementEnabled: false,
        isWeightBased: false,
        availableQuantity: 999999,
        availableWeight: 999999,
        requestedQuantity: requestedQuantity || 0,
        requestedWeight: requestedWeight || 0
      });
    }

    // Get product info to check stock management type
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
      columns: {
        stockManagementType: true,
        name: true,
        productType: true
      }
    });

    if (!product) {
      return NextResponse.json({
        error: 'Product not found'
      }, { status: 404 });
    }

    const isWeightBased = isWeightBasedProduct(product.stockManagementType || 'quantity');
    const isWeightBasedVariable = isWeightBased && product.productType === 'variable';

    // For weight-based variable products, ALWAYS use product-level inventory (variantId = null)
    const inventoryLookupVariantId = isWeightBasedVariable ? null : variantId;

    console.log('Inventory check:', {
      productId,
      productName: product.name,
      productType: product.productType,
      stockManagementType: product.stockManagementType,
      isWeightBasedVariable,
      originalVariantId: variantId,
      inventoryLookupVariantId
    });

    // Validate required parameters based on stock management type
    if (isWeightBased && !requestedWeight && requestedWeight !== 0) {
      return NextResponse.json({
        error: 'Requested weight is required for weight-based products'
      }, { status: 400 });
    }

    if (!isWeightBased && !requestedQuantity && requestedQuantity !== 0) {
      return NextResponse.json({
        error: 'Requested quantity is required for quantity-based products'
      }, { status: 400 });
    }

    // Find inventory record
    const whereConditions = inventoryLookupVariantId
      ? and(
        eq(productInventory.productId, productId),
        eq(productInventory.variantId, inventoryLookupVariantId)
      )
      : eq(productInventory.productId, productId);

    const inventory = await db
      .select()
      .from(productInventory)
      .where(whereConditions!)
      .limit(1);

    if (inventory.length === 0) {
      return NextResponse.json({
        success: false,
        available: false,
        stockManagementEnabled: true,
        isWeightBased,
        availableQuantity: 0,
        availableWeight: 0,
        requestedQuantity: requestedQuantity || 0,
        requestedWeight: requestedWeight || 0,
        message: 'No inventory record found for this product'
      });
    }

    const inv = inventory[0];

    if (isWeightBased) {
      // Weight-based inventory check
      const availableWeight = parseFloat(inv.availableWeight || '0');
      const isAvailable = availableWeight >= (requestedWeight || 0);

      return NextResponse.json({
        success: true,
        available: isAvailable,
        stockManagementEnabled: true,
        isWeightBased: true,
        availableWeight,
        requestedWeight: requestedWeight || 0,
        message: isAvailable
          ? 'Stock available'
          : `Only ${availableWeight}g available`
      });
    } else {
      // Quantity-based inventory check
      const availableQuantity = inv.availableQuantity || 0;
      const isAvailable = availableQuantity >= (requestedQuantity || 0);

      return NextResponse.json({
        success: true,
        available: isAvailable,
        stockManagementEnabled: true,
        isWeightBased: false,
        availableQuantity,
        requestedQuantity: requestedQuantity || 0,
        message: isAvailable
          ? 'Stock available'
          : `Only ${availableQuantity} units available`
      });
    }

  } catch (error) {
    console.error('Error checking inventory:', error);
    return NextResponse.json({
      error: 'Failed to check inventory'
    }, { status: 500 });
  }
}

