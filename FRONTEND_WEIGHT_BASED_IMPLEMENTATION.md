# Frontend Implementation: Weight-Based Variable Products

## Date: December 4, 2025

## Overview
Successfully implemented product-level inventory deduction for weight-based variable products in the frontend order processing system.

## Problem Statement
When customers ordered a weight-based variable product (e.g., coffee in 100g, 250g, 500g packages), the system was attempting to deduct stock from variant-level inventory. This was incorrect because:
- Weight-based variable products have centralized inventory at the product level
- Variants represent package sizes, not separate inventory pools
- Stock should be deducted from the main product inventory regardless of which variant is ordered

## Solution Implemented

### File Modified
**`/src/app/api/orders/route.ts`**

### Changes Made

#### 1. **Inventory Validation (Lines 201-269)**
Updated the pre-order inventory check to:
- Detect weight-based variable products
- Look up inventory at product level (variantId = null) for these products
- Check available weight instead of quantity for weight-based products
- Provide accurate error messages with weight units

**Key Logic:**
```typescript
const isWeightBasedVariable = isWeightBased && productDetails.productType === 'variable';
const inventoryLookupVariantId = isWeightBasedVariable ? null : variantId;

// Look up inventory with appropriate variantId
const inventory = await db
  .select()
  .from(productInventory)
  .where(
    inventoryLookupVariantId 
      ? and(
          eq(productInventory.productId, productId),
          eq(productInventory.variantId, inventoryLookupVariantId)
        )
      : and(
          eq(productInventory.productId, productId),
          isNull(productInventory.variantId)
        )
  );
```

#### 2. **Inventory Deduction (Lines 396-560)**
Updated the post-order inventory deduction to:
- Detect weight-based variable products
- Deduct stock from product level (variantId = null) for these products
- Create stock movement records with variantId = null for weight-based variable products
- Add detailed logging for debugging

**Key Logic:**
```typescript
const isWeightBasedVariable = isWeightBased && productDetails.productType === 'variable';
const inventoryLookupVariantId = isWeightBasedVariable ? null : variantId;

// Deduct from product-level inventory
await db.update(productInventory)
  .set({
    weightQuantity: newWeightQuantity.toString(),
    availableWeight: newAvailableWeight.toString(),
  })
  .where(eq(productInventory.id, currentInventory.id));

// Record stock movement with variantId = null
await db.insert(stockMovements).values({
  variantId: isWeightBasedVariable ? null : (variantId || null),
  notes: `Sold ${requestedWeight}g for order ${orderNumber}${isWeightBasedVariable ? ' (product-level inventory)' : ''}`,
  // ... other fields
});
```

## How It Works

### Example Scenario

**Product**: Premium Coffee Beans
- Type: Variable Product
- Stock Management: Weight-Based
- Main Inventory: 10,000g (10kg)
- Variants:
  - 100g package ($5)
  - 250g package ($12)
  - 500g package ($23)
  - 1kg package ($45)

### Order Flow

#### Step 1: Customer Adds to Cart
```javascript
Customer selects: "250g package" of Premium Coffee Beans
Cart item includes:
  - productId: "coffee-123"
  - variantId: "variant-250g"
  - numericValue: 250 (grams)
  - quantity: 1
```

#### Step 2: Inventory Validation (Pre-Order)
```typescript
// System detects weight-based variable product
isWeightBasedVariable = true

// Looks up inventory at product level (ignores variantId)
inventoryLookupVariantId = null

// Checks main product inventory
SELECT * FROM product_inventory 
WHERE productId = 'coffee-123' 
  AND variantId IS NULL

// Validates available weight
availableWeight: 10,000g
requestedWeight: 250g
✅ Sufficient stock
```

#### Step 3: Order Creation
```typescript
// Order is created with order items
orderItem = {
  productId: 'coffee-123',
  variantId: 'variant-250g', // Stored for reference
  quantity: 1,
  weightQuantity: 250g
}
```

#### Step 4: Inventory Deduction (Post-Order)
```typescript
// System detects weight-based variable product
isWeightBasedVariable = true

// Deducts from product level (ignores variantId)
inventoryLookupVariantId = null

// Updates main product inventory
UPDATE product_inventory 
SET weightQuantity = 9750, availableWeight = 9750
WHERE productId = 'coffee-123' AND variantId IS NULL

// Records stock movement with variantId = null
INSERT INTO stock_movements (
  productId: 'coffee-123',
  variantId: NULL, // Important!
  weightQuantity: 250,
  notes: 'Sold 250g for order ORD-123 (product-level inventory)'
)
```

#### Step 5: Result
```
Main Product Inventory: 9,750g (9.75kg)
All variants still available: ✅
  - 100g package (can sell 97 more)
  - 250g package (can sell 39 more)
  - 500g package (can sell 19 more)
  - 1kg package (can sell 9 more)
```

## Database Impact

### Inventory Records
```sql
-- Weight-based variable products have ONE inventory record
product_inventory
  productId: 'coffee-123'
  variantId: NULL  -- Always null for weight-based variable
  weightQuantity: 9750
  availableWeight: 9750
```

### Stock Movement Records
```sql
-- Stock movements also use variantId = NULL
stock_movements
  productId: 'coffee-123'
  variantId: NULL  -- Always null for weight-based variable
  weightQuantity: 250
  movementType: 'out'
  reason: 'Order fulfillment'
  notes: 'Sold 250g for order ORD-123 (product-level inventory)'
```

## Key Features

### ✅ Accurate Inventory Tracking
- Single source of truth for stock levels
- No confusion about variant-level vs product-level inventory

### ✅ Flexible Ordering
- Customers can order any variant size
- All variants share the same inventory pool

### ✅ Proper Validation
- Pre-order checks ensure sufficient stock
- Weight-based validation for weight-based products
- Clear error messages with appropriate units

### ✅ Detailed Logging
- Console logs for debugging
- Stock movement notes indicate product-level inventory
- Easy to trace inventory changes

## Testing

### Test Scenario 1: Order Weight-Based Variable Product
1. Create weight-based variable product with 3 variants
2. Add 5000g stock to main product (via admin)
3. Customer orders 250g variant
4. Verify:
   - ✅ Order created successfully
   - ✅ Main product inventory reduced by 250g
   - ✅ Stock movement record has variantId = NULL
   - ✅ All variants still available

### Test Scenario 2: Multiple Orders
1. Starting inventory: 5000g
2. Order 1: 250g variant → Inventory: 4750g
3. Order 2: 500g variant → Inventory: 4250g
4. Order 3: 1kg variant → Inventory: 3250g
5. Verify all deductions from main product inventory

### Test Scenario 3: Insufficient Stock
1. Main inventory: 100g
2. Customer tries to order 250g variant
3. Verify:
   - ❌ Order rejected
   - Error: "Insufficient stock... Available: 100g, Requested: 250g"

## Comparison: Before vs After

### ❌ Before (Incorrect)
```typescript
// Looked up variant-level inventory
variantId: 'variant-250g'

// Tried to deduct from variant inventory
UPDATE product_inventory 
WHERE variantId = 'variant-250g'

// Problem: Variant has no inventory!
// Result: Order fails or incorrect deduction
```

### ✅ After (Correct)
```typescript
// Detects weight-based variable product
isWeightBasedVariable = true

// Looks up product-level inventory
inventoryLookupVariantId = null

// Deducts from main product inventory
UPDATE product_inventory 
WHERE productId = 'coffee-123' AND variantId IS NULL

// Result: Correct deduction from centralized inventory
```

## Error Handling

The implementation includes robust error handling:

1. **Product Not Found**
   ```
   Error: "Product not found: Premium Coffee Beans"
   ```

2. **No Inventory Record**
   ```
   Error: "No inventory record found for Premium Coffee Beans"
   ```

3. **Insufficient Weight**
   ```
   Error: "Insufficient stock for Premium Coffee Beans. 
          Available: 100g, Requested: 250g"
   ```

4. **Inventory Update Failure**
   ```
   Console: "Error updating inventory for Premium Coffee Beans: [error]"
   Note: Order still created, but inventory not updated
   ```

## Integration with Admin

The frontend implementation works seamlessly with the admin changes:

1. **Admin adds stock** → Product-level inventory (variantId = null)
2. **Customer orders variant** → Deducts from product-level inventory
3. **Stock movements** → Both admin and frontend use variantId = null
4. **Inventory reports** → Show accurate product-level stock

## Logging

Enhanced logging for debugging:

```typescript
console.log(`Inventory lookup for ${productName}:`, {
  productType: 'variable',
  stockManagementType: 'weight',
  isWeightBasedVariable: true,
  originalVariantId: 'variant-250g',
  inventoryLookupVariantId: null  // Forced to null
});

console.log(`Weight-based deduction for ${productName}:`, {
  quantity: 1,
  numericValue: 250,
  requestedWeight: 250,
  currentWeightQuantity: 10000,
  isWeightBasedVariable: true,
  inventoryLookupVariantId: null
});
```

## Benefits

### 🎯 For Customers
- Can order any variant size
- Accurate stock availability
- Clear error messages

### 🎯 For Admins
- Simplified inventory management
- Single inventory pool to track
- Accurate stock reports

### 🎯 For Developers
- Consistent logic across admin and frontend
- Clear code with detailed comments
- Easy to debug with logging

## Future Enhancements

Potential improvements:
1. Add real-time stock updates via WebSocket
2. Implement stock reservation during checkout
3. Add low-stock warnings on product pages
4. Create inventory history viewer for customers

## Troubleshooting

### Issue: Stock not deducting
**Check:**
1. Stock management enabled in settings
2. Product has `stockManagementType = 'weight'`
3. Product has `productType = 'variable'`
4. Inventory record exists with `variantId = NULL`

### Issue: Wrong inventory deduction
**Check:**
1. `numericValue` is being passed in cart item
2. `numericValue` matches variant weight (e.g., 250 for 250g)
3. Console logs show `isWeightBasedVariable = true`

### Issue: Order fails with "No inventory record"
**Check:**
1. Inventory exists at product level (variantId = NULL)
2. Not at variant level (variantId = 'variant-xxx')
3. Run admin stock movement to create product-level inventory

## Summary

The frontend implementation ensures that:
- ✅ Weight-based variable products deduct from product-level inventory
- ✅ Inventory validation checks product-level stock
- ✅ Stock movements record product-level changes
- ✅ All variants share the same inventory pool
- ✅ System works seamlessly with admin changes

---

**Implementation Status**: ✅ Complete
**Testing Status**: ⏳ Pending User Testing
**Documentation**: ✅ Complete
