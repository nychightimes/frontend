# Product Details Page Updates: Weight-Based Variable Products

## Date: December 4, 2025

## Overview
Updated the product details page (`/product/[id]`) to correctly check inventory at the product level for weight-based variable products.

## Problem
The product details page was checking inventory at the variant level for all variable products, including weight-based ones. This caused incorrect stock availability displays because:
- Weight-based variable products store inventory at product level (variantId = null)
- The page was looking for variant-level inventory (variantId = 'variant-xxx')
- This resulted in "Out of Stock" messages even when product had inventory

## Solution

### Files Modified

#### 1. **`/src/app/product/[id]/page.tsx`**

**Changes Made:**
- Updated `fetchInventory` function (lines 153-184)
- Detects weight-based variable products
- Forces product-level inventory lookup (variantId = null)
- Added detailed logging for debugging

**Key Logic:**
```typescript
const isWeightBasedVariable = isWeightBased && product?.productType === 'variable';
const inventoryLookupVariantId = isWeightBasedVariable ? null : variantId;

// Fetch inventory with appropriate variantId
await fetch('/api/inventory/check', {
  body: JSON.stringify({
    productId,
    variantId: inventoryLookupVariantId, // null for weight-based variable
  }),
});
```

#### 2. **`/src/app/api/inventory/check/route.ts`**

**Changes Made:**
- Updated inventory lookup logic (lines 70-97)
- Detects weight-based variable products
- Forces product-level inventory lookup (variantId = null)
- Added detailed logging for debugging

**Key Logic:**
```typescript
const isWeightBasedVariable = isWeightBased && product.productType === 'variable';
const inventoryLookupVariantId = isWeightBasedVariable ? null : variantId;

// Look up inventory with appropriate variantId
const whereConditions = inventoryLookupVariantId 
  ? and(
      eq(productInventory.productId, productId),
      eq(productInventory.variantId, inventoryLookupVariantId)
    )
  : eq(productInventory.productId, productId);
```

## How It Works Now

### Example Scenario

**Product**: Premium Coffee Beans
- Type: Variable Product
- Stock Management: Weight-Based
- Main Inventory: 10,000g
- Variants: 100g, 250g, 500g, 1kg

### User Flow

#### Step 1: User Opens Product Page
```
URL: /product/coffee-123
Product loads with all variants displayed
```

#### Step 2: User Selects Variant
```
User selects: "250g package"
Variant price: $12.00
```

#### Step 3: System Checks Inventory
```typescript
// Old behavior (incorrect):
fetchInventory(productId: 'coffee-123', variantId: 'variant-250g')
→ Looks for inventory with variantId = 'variant-250g'
→ Not found! (because inventory is at product level)
→ Shows "Out of Stock" ❌

// New behavior (correct):
fetchInventory(productId: 'coffee-123', variantId: 'variant-250g')
→ Detects weight-based variable product
→ Forces variantId = null
→ Looks for inventory with variantId = null
→ Found! 10,000g available ✅
→ Shows "10000g available" ✅
```

#### Step 4: Stock Display
```
Stock Status: 10000g available ✅
For selected variant: SKU-250g
```

#### Step 5: Add to Cart
```
Button enabled: "Add to Cart" ✅
(Previously would show "Out of Stock" ❌)
```

## UI Changes

### Stock Status Display

**For Simple Products:**
```tsx
{product.productType === 'simple' && stockManagementEnabled && (
  <Badge>
    {product.stockManagementType === 'weight'
      ? `${availableQuantity}g available`
      : `${availableQuantity} available`}
  </Badge>
)}
```

**For Variable Products (with variant selected):**
```tsx
{product.productType === 'variable' && selectedVariant && (
  <div>
    <Badge>
      {product.stockManagementType === 'weight'
        ? `${availableQuantity}g available`
        : `${availableQuantity} available`}
    </Badge>
    <div className="text-xs">
      For selected variant: {selectedVariant.sku}
    </div>
  </div>
)}
```

**Note**: For weight-based variable products, `availableQuantity` now shows the **product-level** inventory, not variant-level.

## Logging

Enhanced logging for debugging:

```typescript
// In page.tsx
console.log('Fetching inventory:', {
  productId,
  originalVariantId: variantId,
  isWeightBasedVariable,
  inventoryLookupVariantId,
  productType: product?.productType,
  stockManagementType: product?.stockManagementType
});

// In API route
console.log('Inventory check:', {
  productId,
  productName: product.name,
  productType: product.productType,
  stockManagementType: product.stockManagementType,
  isWeightBasedVariable,
  originalVariantId: variantId,
  inventoryLookupVariantId
});
```

## Testing

### Test Scenario 1: Weight-Based Variable Product

**Setup:**
1. Create weight-based variable product
2. Add 5000g stock to product level (via admin)
3. Product has 3 variants (100g, 250g, 500g)

**Test:**
1. Open product page
2. Select 250g variant
3. Check stock display

**Expected:**
- ✅ Shows "5000g available"
- ✅ "Add to Cart" button enabled
- ✅ Console shows `inventoryLookupVariantId: null`

### Test Scenario 2: Quantity-Based Variable Product

**Setup:**
1. Create quantity-based variable product
2. Add stock to specific variants

**Test:**
1. Open product page
2. Select a variant
3. Check stock display

**Expected:**
- ✅ Shows variant-specific stock
- ✅ Uses variant-level inventory
- ✅ Console shows `inventoryLookupVariantId: 'variant-xxx'`

### Test Scenario 3: Simple Product

**Setup:**
1. Create simple product (weight or quantity based)
2. Add stock

**Test:**
1. Open product page
2. Check stock display

**Expected:**
- ✅ Shows product stock
- ✅ No variant selection
- ✅ Correct stock display

## Comparison: Before vs After

### ❌ Before (Incorrect)

```typescript
// Always used the provided variantId
fetchInventory(productId, variantId)
↓
API checks: variantId = 'variant-250g'
↓
Database query: WHERE variantId = 'variant-250g'
↓
Result: No inventory found (inventory is at product level)
↓
UI shows: "Out of Stock" ❌
```

### ✅ After (Correct)

```typescript
// Detects weight-based variable and forces null
fetchInventory(productId, variantId)
↓
Detects: isWeightBasedVariable = true
↓
Forces: inventoryLookupVariantId = null
↓
API checks: variantId = null
↓
Database query: WHERE variantId IS NULL
↓
Result: Inventory found! 10,000g available
↓
UI shows: "10000g available" ✅
```

## Integration with Other Components

### Works With:
1. **Admin Stock Management** - Stock added at product level
2. **Order Processing** - Deducts from product level
3. **Cart System** - Uses product-level availability
4. **Inventory API** - Checks product-level stock

### Consistent Behavior:
- Admin adds stock → Product level (variantId = null)
- Product page checks → Product level (variantId = null)
- Customer orders → Deducts from product level
- All systems use same inventory pool ✅

## Benefits

### ✅ Accurate Stock Display
- Shows correct availability for weight-based variable products
- No more false "Out of Stock" messages
- Customers can see actual available weight

### ✅ Better UX
- Customers can add products to cart
- Clear stock information
- Consistent with admin system

### ✅ Maintainable Code
- Consistent logic across all components
- Clear comments and logging
- Easy to debug

## Troubleshooting

### Issue: Still showing "Out of Stock"

**Check:**
1. Product has `productType = 'variable'`
2. Product has `stockManagementType = 'weight'`
3. Inventory exists at product level (variantId = null)
4. Console logs show `inventoryLookupVariantId: null`

**Solution:**
```sql
-- Verify inventory record
SELECT * FROM product_inventory 
WHERE productId = 'your-product-id' 
  AND variantId IS NULL;

-- Should return a record with weightQuantity > 0
```

### Issue: Console shows wrong variantId

**Check:**
1. Console log for `isWeightBasedVariable`
2. Should be `true` for weight-based variable products
3. `inventoryLookupVariantId` should be `null`

**Solution:**
- Verify product settings in admin
- Check `productType` and `stockManagementType`

### Issue: Different stock for different variants

**This is expected for:**
- Quantity-based variable products (each variant has own stock)

**This is NOT expected for:**
- Weight-based variable products (all share product-level stock)

## Summary

The product details page now correctly:
- ✅ Detects weight-based variable products
- ✅ Checks inventory at product level (variantId = null)
- ✅ Displays accurate stock availability
- ✅ Enables "Add to Cart" when stock is available
- ✅ Works consistently with admin and order systems

---

**Implementation Status**: ✅ Complete
**Testing Status**: ⏳ Pending User Testing
**Documentation**: ✅ Complete
