# Fix: Stock Deduction for Weight-Based Variable Products

## Date: December 4, 2025

## Problem
When customers placed orders from the frontend for weight-based variable products, the stock was **not being deducted** from inventory.

## Root Cause
The server action (`/app/checkout/actions.ts`) was missing the logic to detect weight-based **variable** products. It was only checking `stockManagementType` but not `productType`, so it couldn't determine if the product was a weight-based variable product that requires product-level inventory lookup.

### The Issue
```typescript
// OLD CODE (Incorrect)
const productDetails = await db.query.products.findFirst({
  where: eq(products.id, productId),
  columns: { stockManagementType: true } // ❌ Missing productType!
});

const isWeightBased = productDetails.stockManagementType === 'weight';

// This would look up variant-level inventory for weight-based variable products
const inventory = await db.select().from(productInventory)
  .where(
    variantId 
      ? eq(productInventory.variantId, variantId) // ❌ Wrong for weight-based variable
      : eq(productInventory.productId, productId)
  );
```

**Result**: For weight-based variable products, it tried to find inventory with `variantId = 'variant-xxx'`, but the inventory is stored with `variantId = NULL` at the product level. So it found no inventory and skipped the stock deduction!

## Solution

### File Modified
**`/frontend/src/app/checkout/actions.ts`** (lines 426-557)

### Changes Made

1. **Added `productType` to query**
```typescript
const productDetails = await db.query.products.findFirst({
  where: eq(products.id, productId),
  columns: { stockManagementType: true, productType: true } // ✅ Added productType
});
```

2. **Detect weight-based variable products**
```typescript
const isWeightBased = productDetails.stockManagementType === 'weight';
const isWeightBasedVariable = isWeightBased && productDetails.productType === 'variable';
```

3. **Force product-level inventory lookup**
```typescript
// For weight-based variable products, ALWAYS use product-level inventory (variantId = null)
const inventoryLookupVariantId = isWeightBasedVariable ? null : variantId;
```

4. **Updated inventory query**
```typescript
const inventory = await db.select().from(productInventory)
  .where(
    inventoryLookupVariantId 
      ? and(
          eq(productInventory.productId, productId),
          eq(productInventory.variantId, inventoryLookupVariantId)
        )
      : and(
          eq(productInventory.productId, productId),
          isNull(productInventory.variantId) // ✅ Correct for weight-based variable
        )
  );
```

5. **Updated stock movement record**
```typescript
await db.insert(stockMovements).values({
  // ...
  variantId: isWeightBasedVariable ? null : (variantId || null), // ✅ Null for weight-based variable
  notes: `Sold ${requestedWeight}g for order ${orderNumber}${isWeightBasedVariable ? ' (product-level inventory)' : ''}`,
  // ...
});
```

## How It Works Now

### Example: Customer Orders Coffee

**Product**: Premium Coffee Beans
- Type: Variable Product
- Stock Management: Weight-Based
- Main Inventory: 10,000g (product level, variantId = NULL)
- Variants: 100g, 250g, 500g, 1kg

**Order Flow**:

#### Before (Broken):
```
1. Customer orders: 250g variant
2. Server action checks: productType? ❌ Not checked
3. Assumes: Regular variable product
4. Looks for inventory: variantId = 'variant-250g'
5. Result: No inventory found (it's at product level!)
6. Stock deduction: SKIPPED ❌
7. Inventory: Still 10,000g (unchanged) ❌
```

#### After (Fixed):
```
1. Customer orders: 250g variant
2. Server action checks: productType = 'variable', stockManagementType = 'weight'
3. Detects: Weight-based variable product ✅
4. Forces: inventoryLookupVariantId = null
5. Looks for inventory: variantId = NULL (product level)
6. Result: Inventory found! 10,000g available ✅
7. Stock deduction: 250g deducted ✅
8. New inventory: 9,750g ✅
9. Stock movement: Created with variantId = NULL ✅
```

## Testing

### Test Scenario

1. **Setup**:
   - Create weight-based variable product
   - Add 5000g stock via admin
   - Product has 3 variants (100g, 250g, 500g)

2. **Place Order**:
   - Customer adds 250g variant to cart
   - Completes checkout
   - Order is created

3. **Verify**:
   ```sql
   -- Check inventory was deducted
   SELECT * FROM product_inventory 
   WHERE productId = 'your-product-id' AND variantId IS NULL;
   -- Should show: weightQuantity = 4750 (was 5000, deducted 250)
   
   -- Check stock movement was created
   SELECT * FROM stock_movements 
   WHERE productId = 'your-product-id' 
   ORDER BY createdAt DESC LIMIT 1;
   -- Should show: variantId = NULL, weightQuantity = 250, notes contains '(product-level inventory)'
   ```

## Console Logs

The fix includes detailed logging:

```
=== WEIGHT-BASED DEDUCTION ===
Product: Premium Coffee Beans
quantity: 1
numericValue: 250
requestedWeight (will deduct): 250g
currentWeightQuantity: 5000g
isWeightBasedVariable: true
inventoryLookupVariantId: null

✓ Using numericValue: 250g

🔄 DEDUCTING FROM STOCK:

Product: Premium Coffee Beans
Current Stock: 5000g
Will Deduct: 250g
New Stock: 4750g

numericValue from cart: 250
Using: 250g
```

## Related Files

This fix completes the weight-based variable products implementation:

1. **Admin Stock Management** ✅
   - `/admin/app/inventory/stock-movements/add/page.tsx`
   - `/admin/app/api/inventory/stock-movements/route.ts`

2. **Frontend Order API** ✅
   - `/frontend/src/app/api/orders/route.ts`

3. **Frontend Server Action** ✅ **FIXED**
   - `/frontend/src/app/checkout/actions.ts`

4. **Product Details Page** ✅
   - `/frontend/src/app/product/[id]/page.tsx`
   - `/frontend/src/app/api/inventory/check/route.ts`

## Summary

The issue was that the server action (used during checkout) wasn't detecting weight-based variable products correctly. It was missing the `productType` check, so it couldn't determine that inventory should be looked up at the product level (variantId = NULL) instead of the variant level.

**Fix**: Added the same logic that exists in `/api/orders/route.ts` to the server action:
- Query `productType` along with `stockManagementType`
- Detect weight-based variable products
- Force `inventoryLookupVariantId = null` for these products
- Update stock movement records to use `variantId = null`

**Result**: Stock is now correctly deducted from product-level inventory when customers order weight-based variable products! ✅

---

**Status**: ✅ FIXED
**Testing**: ⏳ Pending User Verification
