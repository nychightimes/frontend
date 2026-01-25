import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import { readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

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

async function createAdminUser() {
  // Load environment variables
  loadEnv();

  // Create connection
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || '',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || '',
  });

  try {
    console.log('🔗 Connected to database\n');

    // Admin user details
    const email = 'demo@admin.com';
    const password = 'password123';
    const name = 'Demo Admin';
    const role = 'super_admin';

    // Generate IDs
    const adminUserId = randomUUID();
    const roleId = randomUUID();

    // Hash password
    console.log('🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if admin role exists
    console.log('📋 Checking for admin role...');
    const [roleRows] = await connection.query(
      `SELECT id FROM admin_roles WHERE name = ?`,
      [role]
    );

    let finalRoleId = roleId;

    if ((roleRows as any[]).length > 0) {
      finalRoleId = (roleRows as any[])[0].id;
      console.log(`   ✓ Admin role already exists (ID: ${finalRoleId})`);
    } else {
      // Create admin role
      console.log('📝 Creating admin role...');
      const permissions = JSON.stringify({
        all: true,
        users: { read: true, write: true, delete: true },
        products: { read: true, write: true, delete: true },
        orders: { read: true, write: true, delete: true },
        settings: { read: true, write: true },
        reports: { read: true }
      });

      await connection.query(
        `INSERT INTO admin_roles (id, name, permissions, createdAt, updatedAt) 
         VALUES (?, ?, ?, NOW(), NOW())`,
        [roleId, role, permissions]
      );
      console.log(`   ✓ Admin role created (ID: ${roleId})`);
    }

    // Check if admin user already exists
    console.log('\n👤 Checking for existing admin user...');
    const [userRows] = await connection.query(
      `SELECT id FROM admin_users WHERE email = ?`,
      [email]
    );

    if ((userRows as any[]).length > 0) {
      console.log(`   ⚠️  Admin user already exists with email: ${email}`);
      console.log('   💡 Updating password...');
      
      await connection.query(
        `UPDATE admin_users SET password = ?, updatedAt = NOW() WHERE email = ?`,
        [hashedPassword, email]
      );
      console.log('   ✓ Password updated successfully');
    } else {
      // Create admin user
      console.log('📝 Creating admin user...');
      await connection.query(
        `INSERT INTO admin_users (id, email, password, name, roleId, role, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [adminUserId, email, hashedPassword, name, finalRoleId, role]
      );
      console.log('   ✓ Admin user created successfully');
    }

    console.log('\n🎉 Admin setup completed!\n');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('👤 Name:', name);
    console.log('🛡️  Role:', role);
    console.log('\n✅ You can now login to the admin panel with these credentials.');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

createAdminUser().catch(console.error);
