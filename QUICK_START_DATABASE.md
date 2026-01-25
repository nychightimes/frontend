# Quick Start - Database Management

## ✅ Current Status

Your MySQL database is **fully set up** with all 49 tables from your Drizzle schema.

## Available Commands

### View Your Database Visually
```bash
npm run db:studio
```
Opens Drizzle Studio in your browser to browse and edit data.

### Verify Database Schema
```bash
npm run db:verify
```
Shows all tables in your database and confirms they match your schema.

### Make Schema Changes

When you modify `src/lib/schema.ts`:

```bash
# 1. Generate migration SQL
npm run db:generate

# 2. Apply the migration
npm run db:migrate

# 3. Verify it worked
npm run db:verify
```

## Your Database Configuration

**Location:** `.env` file (already configured)

```env
DB_HOST=your-database-host
DB_USER=your-database-user
DB_PASS=your-database-password
DB_NAME=your-database-name
DB_PORT=your-database-port
```

**Connection String Format:** (for other tools)
```
mysql://[USER]:[PASSWORD]@[HOST]:[PORT]/[DATABASE]?ssl-mode=REQUIRED
```

> **Note:** Your actual credentials are stored securely in the `.env` file which is gitignored and not committed to the repository.

## All Database Tables (49)

✅ **Authentication** - user, account, sessions, verification_tokens  
✅ **Products** - products, product_variants, categories, subcategories  
✅ **Inventory** - product_inventory, stock_movements  
✅ **Orders** - orders, order_items  
✅ **Coupons** - coupons, coupon_redemptions, coupon_included/excluded_products/categories  
✅ **Returns** - returns, return_items, refunds  
✅ **Drivers** - drivers, driver_assignments, driver_assignment_history, driver_order_rejections  
✅ **Communication** - chat_conversations, chat_messages, twilio_conversations, twilio_call_sessions  
✅ **Loyalty** - user_loyalty_points, loyalty_points_history  
✅ **Add-ons** - addons, addon_groups, product_addons  
✅ **Tags** - tags, tag_groups, product_tags  
✅ **Variations** - variation_attributes, variation_attribute_values  
✅ **Admin** - admin_users, admin_roles, admin_logs  
✅ **Shipping** - pickup_locations, shipping_labels  
✅ **Settings** - settings, domain_verification, global_magic_link, magic_link_usage

## Fixed Issues

✅ **Primary Key Issue** - Fixed `product_categories` table to have composite primary key  
✅ **DateTime Default** - Fixed `created_at` column to use proper SQL syntax  
✅ **Schema Sync** - All tables and columns are now in sync with your schema

## Using Drizzle in Your Code

```typescript
import { db } from '@/lib/db';
import { products, orders, user } from '@/lib/schema';
import { eq } from 'drizzle-orm';

// Query example
const allProducts = await db.select().from(products);

// Insert example
await db.insert(orders).values({
  id: 'order-123',
  email: 'customer@example.com',
  subtotal: '99.99',
  totalAmount: '99.99',
  // ... other fields
});

// Update example
await db
  .update(user)
  .set({ status: 'approved' })
  .where(eq(user.id, 'user-123'));
```

## Common Tasks

### Add a New Column
1. Edit `src/lib/schema.ts`
2. Run `npm run db:generate`
3. Run `npm run db:migrate`

### Add a New Table
1. Define table in `src/lib/schema.ts`
2. Add relations if needed
3. Run `npm run db:generate`
4. Run `npm run db:migrate`

### Rename a Column
⚠️ Requires careful migration - Drizzle will DROP and recreate!
1. Consider using ALTER instead of DROP/CREATE
2. Edit migration SQL manually if needed
3. Always backup first

## Troubleshooting

### "Cannot connect to database"
- Check your internet connection
- Verify `.env` credentials are correct
- Ensure DigitalOcean database is running

### "Duplicate column name"
- This is normal during migration
- The script skips existing columns automatically

### Changes not appearing in database
- Did you run `npm run db:migrate`?
- Check the migration file in `drizzle/` folder
- Run `npm run db:verify` to check status

## Next Steps

1. ✅ Your database is ready to use
2. 🚀 Start building your application
3. 📊 Use `npm run db:studio` to view data
4. 🔄 Use migrations when updating schema

## Documentation

- 📖 [Full Setup Guide](./DATABASE_SETUP.md)
- 🛠️ [Scripts Documentation](./scripts/README.md)
- 🔗 [Drizzle ORM Docs](https://orm.drizzle.team/docs/overview)
- 🗄️ [MySQL Docs](https://dev.mysql.com/doc/)
