# Weight Deduction Decimal Issue Fix

## Problem
When creating an order for a variable + weight-based product with a decimal weight value (e.g., 3.5 grams), the system deducts 4 grams instead of 3.5 grams from inventory.

## Root Cause
The issue is likely that the `numeric_value_of_variation_attribute` column in the `product_variants` table is defined as `INT` instead of `DECIMAL` in the actual MySQL database, even though the Drizzle schema defines it as `decimal`.

## Solution
Run the following SQL command to alter the column type:

```sql
ALTER TABLE product_variants 
MODIFY COLUMN numeric_value_of_variation_attribute DECIMAL(10,2);
```

This will allow the column to store decimal values like 3.5, 7.25, etc.

## Verification
After running the SQL command:
1. Create a new variant with a decimal weight (e.g., 3.5g)
2. Add it to cart
3. Complete checkout
4. Verify that exactly 3.5g was deducted from inventory (not 4g)

## Alternative Check
If the column type is already DECIMAL, the issue might be in how the value is being inserted. Check the admin panel when creating/editing variants to ensure decimal values are being saved correctly.
