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
    console.warn('⚠️  Could not load .env file');
  }
}

async function checkAdminUser() {
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

    const [users] = await connection.query(`
      SELECT id, email, name, role, createdAt 
      FROM admin_users 
      ORDER BY createdAt DESC
    `);

    console.log('👥 Admin Users in Database:\n');
    
    if ((users as any[]).length === 0) {
      console.log('   No admin users found.');
    } else {
      (users as any[]).forEach((user, index) => {
        console.log(`${index + 1}. ${user.name || 'No name'}`);
        console.log(`   📧 Email: ${user.email}`);
        console.log(`   🛡️  Role: ${user.role}`);
        console.log(`   🆔 ID: ${user.id}`);
        console.log(`   📅 Created: ${user.createdAt}`);
        console.log('');
      });
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkAdminUser().catch(console.error);
