import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env file
function loadEnv() {
  try {
    const envPath = join(process.cwd(), '.env');
    const envContent = readFileSync(envPath, 'utf-8');
    
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=:#]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  } catch (error) {
    console.warn('⚠️  Could not load .env file, using environment variables');
  }
}

async function verifyTables() {
  // Load environment variables
  loadEnv();

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || '',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || '',
  });

  try {
    console.log('🔗 Connected to database\n');

    // Expected tables from schema.ts
    const expectedTables = [
      'user', 'account', 'sessions', 'verification_tokens',
      'categories', 'subcategories', 'products', 'product_variants',
      'product_inventory', 'stock_movements', 'orders', 'order_items',
      'coupons', 'coupon_redemptions', 'drivers', 'driver_assignments',
      'pickup_locations', 'chat_conversations', 'chat_messages',
      'loyalty_points_history', 'user_loyalty_points', 'domain_verification',
      'product_categories', 'global_magic_link', 'magic_link_usage',
      'addons', 'addon_groups', 'product_addons', 'admin_users',
      'admin_roles', 'admin_logs', 'tags', 'tag_groups', 'product_tags',
      'variation_attributes', 'variation_attribute_values',
      'returns', 'return_items', 'refunds', 'shipping_labels',
      'twilio_conversations', 'twilio_call_sessions',
      'driver_assignment_history', 'driver_order_rejections', 'settings',
      'coupon_included_products', 'coupon_excluded_products',
      'coupon_included_categories', 'coupon_excluded_categories'
    ];

    // Get all tables in database
    const [rows] = await connection.query(`SHOW TABLES`);
    const existingTables = (rows as any[]).map(row => Object.values(row)[0] as string);

    console.log('✅ Existing tables in database:');
    existingTables.sort().forEach(table => console.log(`   - ${table}`));

    console.log(`\n📊 Total tables: ${existingTables.length}`);

    // Check for missing tables
    const missingTables = expectedTables.filter(table => !existingTables.includes(table));
    
    if (missingTables.length > 0) {
      console.log(`\n⚠️  Missing tables (${missingTables.length}):`);
      missingTables.forEach(table => console.log(`   - ${table}`));
    } else {
      console.log('\n🎉 All expected tables exist!');
    }

    // Check for extra tables
    const extraTables = existingTables.filter(table => !expectedTables.includes(table));
    if (extraTables.length > 0) {
      console.log(`\n📝 Extra tables not in schema (${extraTables.length}):`);
      extraTables.forEach(table => console.log(`   - ${table}`));
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

verifyTables().catch(console.error);
