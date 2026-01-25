# Frontend Quick Reference: Weight-Based Variable Products

## 🎯 What Changed?

When customers order weight-based variable products, inventory is now deducted from the **PRODUCT level**, not the variant level.

## 📦 How Orders Work Now

### Example: Premium Coffee Beans

**Setup:**
- Main Inventory: 10kg (10,000g)
- Variants: 100g, 250g, 500g, 1kg packages

**Customer Order Flow:**

```
1. Customer selects: "250g package"
   ↓
2. System checks: Main product inventory (10kg available)
   ↓
3. Order created: 250g deducted from main inventory
   ↓
4. New inventory: 9.75kg (9,750g)
   ↓
5. All variants still available ✅
```

## 🔍 Key Implementation Details

### Inventory Validation (Before Order)
```typescript
// Detects weight-based variable product
const isWeightBasedVariable = 
  isWeightBased && productType === 'variable';

// Forces product-level lookup
const inventoryLookupVariantId = 
  isWeightBasedVariable ? null : variantId;

// Checks main product inventory
SELECT * FROM product_inventory 
WHERE productId = 'xxx' 
  AND variantId IS NULL  // Always null for weight-based variable
```

### Inventory Deduction (After Order)
```typescript
// Deducts from product level
UPDATE product_inventory 
SET weightQuantity = weightQuantity - 250
WHERE productId = 'xxx' 
  AND variantId IS NULL  // Always null for weight-based variable

// Records movement with variantId = null
INSERT INTO stock_movements (
  productId: 'xxx',
  variantId: NULL,  // Important!
  weightQuantity: 250,
  notes: 'Sold 250g (product-level inventory)'
)
```

## ✅ What Works

### Correct Behavior
```
Product: Coffee (10kg total)
Order 1: 250g package → Inventory: 9.75kg ✅
Order 2: 500g package → Inventory: 9.25kg ✅
Order 3: 1kg package → Inventory: 8.25kg ✅
All variants available as long as main inventory has stock ✅
```

### Error Handling
```
Main Inventory: 100g
Customer orders: 250g package
Result: ❌ "Insufficient stock. Available: 100g, Requested: 250g"
```

## 🔧 File Modified

**`/src/app/api/orders/route.ts`**

### Changes:
1. **Lines 201-269**: Inventory validation
   - Detects weight-based variable products
   - Checks product-level inventory
   - Validates available weight

2. **Lines 396-560**: Inventory deduction
   - Deducts from product-level inventory
   - Creates stock movements with variantId = null
   - Adds detailed logging

## 📊 Database Records

### Inventory Table
```sql
product_inventory
  productId: 'coffee-123'
  variantId: NULL  -- Always null for weight-based variable
  weightQuantity: 9750
  availableWeight: 9750
```

### Stock Movements Table
```sql
stock_movements
  productId: 'coffee-123'
  variantId: NULL  -- Always null for weight-based variable
  weightQuantity: 250
  movementType: 'out'
  notes: 'Sold 250g for order ORD-123 (product-level inventory)'
```

## 🧪 Testing Checklist

- [ ] Create weight-based variable product
- [ ] Add stock via admin (e.g., 5000g)
- [ ] Customer orders 250g variant
- [ ] Verify inventory reduced by 250g
- [ ] Check `product_inventory.variantId` is NULL
- [ ] Check `stock_movements.variantId` is NULL
- [ ] Verify all variants still available
- [ ] Test insufficient stock scenario

## 🐛 Debugging

### Check Console Logs
```javascript
// Look for these logs:
"Inventory lookup for Premium Coffee Beans: {
  isWeightBasedVariable: true,
  inventoryLookupVariantId: null
}"

"Weight-based deduction for Premium Coffee Beans: {
  requestedWeight: 250,
  currentWeightQuantity: 10000,
  isWeightBasedVariable: true
}"
```

### Verify Database
```sql
-- Check inventory record
SELECT * FROM product_inventory 
WHERE productId = 'your-product-id' 
  AND variantId IS NULL;

-- Check stock movements
SELECT * FROM stock_movements 
WHERE productId = 'your-product-id' 
  AND movementType = 'out'
ORDER BY createdAt DESC;
```

## ⚠️ Common Issues

### Issue: Stock not deducting
**Solution:**
1. Check stock management is enabled in settings
2. Verify product has `stockManagementType = 'weight'`
3. Verify product has `productType = 'variable'`
4. Ensure inventory exists at product level (variantId = NULL)

### Issue: "No inventory record found"
**Solution:**
1. Go to admin `/inventory/stock-movements/add`
2. Select the product
3. Add stock (e.g., 5000g)
4. Verify inventory created with variantId = NULL

### Issue: Wrong weight deducted
**Solution:**
1. Check cart item has `numericValue` field
2. Verify `numericValue` matches variant weight
3. Check console logs for `requestedWeight` value

## 🔗 Integration Points

### With Admin System
1. Admin adds stock → Product level (variantId = null)
2. Customer orders → Deducts from product level
3. Stock movements → Both use variantId = null
4. Reports → Show accurate product-level stock

### With Cart System
Cart items must include:
```javascript
{
  productId: 'coffee-123',
  variantId: 'variant-250g',  // For display/reference
  numericValue: 250,           // Weight in grams (REQUIRED)
  quantity: 1,
  price: 12.00
}
```

## 📈 Benefits

### For Customers
- ✅ Can order any variant size
- ✅ Accurate stock availability
- ✅ Clear error messages

### For Business
- ✅ Simplified inventory management
- ✅ Accurate stock tracking
- ✅ Realistic inventory model

### For Developers
- ✅ Consistent logic across admin/frontend
- ✅ Clear code with comments
- ✅ Easy debugging with logs

## 📚 Full Documentation

See: `FRONTEND_WEIGHT_BASED_IMPLEMENTATION.md`

---

**Quick Tip**: Weight-based variable products = One inventory pool for all variants! 🎯
