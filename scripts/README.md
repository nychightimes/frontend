# Database Scripts

This folder contains utility scripts for managing your MySQL database with Drizzle ORM.

## Available Scripts

### 1. `migrate.ts` - Apply Database Migrations

Applies SQL migrations from the `drizzle/` folder to your database.

**Usage:**
```bash
# Via npm script (recommended)
npm run db:migrate

# Or directly with environment variables
DB_HOST=... DB_USER=... DB_PASS=... DB_NAME=... DB_PORT=... npm run db:migrate
```

**What it does:**
- Connects to your MySQL database
- Reads the latest migration SQL file
- Executes each statement safely
- Skips tables/columns that already exist
- Reports success/failure for each operation

### 2. `verify-tables.ts` - Verify Database Schema

Checks which tables exist in your database and compares them to your schema.

**Usage:**
```bash
# Via npm script (recommended)
npm run db:verify

# Or directly
DB_HOST=... DB_USER=... DB_PASS=... DB_NAME=... DB_PORT=... npm run db:verify
```

**What it shows:**
- List of all existing tables
- Missing tables (if any)
- Extra tables not in schema
- Total table count

## Environment Variables

All scripts read database credentials from environment variables:

```env
DB_HOST=your-database-host
DB_PORT=3306
DB_USER=your-username
DB_PASS=your-password
DB_NAME=your-database-name
```

These are automatically loaded from your `.env` file when using npm scripts.

## Workflow

### When Making Schema Changes

1. **Edit** `src/lib/schema.ts` with your changes
2. **Generate** migration: `npm run db:generate`
3. **Review** the SQL in `drizzle/` folder
4. **Apply** migration: `npm run db:migrate`
5. **Verify** changes: `npm run db:verify`

### Example: Adding a New Table

```typescript
// 1. Add to src/lib/schema.ts
export const newTable = mysqlTable("new_table", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: datetime("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// 2. Generate migration
// $ npm run db:generate

// 3. Apply migration
// $ npm run db:migrate

// 4. Verify
// $ npm run db:verify
```

## Safety Features

### migrate.ts
- ✅ Checks if tables exist before creating
- ✅ Skips duplicate columns/constraints
- ✅ Reports detailed error messages
- ✅ Uses transactions where possible

### verify-tables.ts
- ✅ Read-only operations
- ✅ No modifications to database
- ✅ Safe to run anytime

## Troubleshooting

### Connection Refused
Check your database credentials in `.env` and ensure the database is accessible.

### Duplicate Column Errors
This is normal - the script skips already existing columns. No action needed.

### Primary Key Errors
If you see primary key errors, it's likely because MySQL's `sql_require_primary_key` setting is enabled. The migration script handles this by checking for existing tables first.

## Notes

- These scripts are designed for your DigitalOcean MySQL database
- Always backup your database before running migrations in production
- The scripts load environment variables from `.env` automatically
- Use `npm run db:studio` to visually browse your database
