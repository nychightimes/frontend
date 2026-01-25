import { readFileSync } from 'fs';
import { join } from 'path';
import mysql from 'mysql2/promise';

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

async function runMigrations() {
  // Load environment variables
  loadEnv();

  // Create connection
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || '',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || '',
    multipleStatements: true,
  });

  try {
    console.log('🔗 Connected to database');

    // Read the migration SQL file
    const migrationPath = join(process.cwd(), 'drizzle', '0001_rare_captain_marvel.sql');
    const sql = readFileSync(migrationPath, 'utf-8');

    // Split by statement-breakpoint and execute each statement
    const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(s => s);

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement) continue;

      try {
        console.log(`\n⏳ Executing statement ${i + 1}/${statements.length}...`);
        
        // For CREATE TABLE statements, check if table exists first
        if (statement.toUpperCase().startsWith('CREATE TABLE')) {
          const tableNameMatch = statement.match(/CREATE TABLE `(\w+)`/i);
          if (tableNameMatch) {
            const tableName = tableNameMatch[1];
            const [rows] = await connection.query(
              `SHOW TABLES LIKE '${tableName}'`
            );
            if ((rows as any[]).length > 0) {
              console.log(`   ⚠️  Table '${tableName}' already exists, skipping...`);
              continue;
            }
          }
        }

        await connection.query(statement);
        console.log(`   ✅ Statement ${i + 1} executed successfully`);
      } catch (error: any) {
        // Some errors are expected (like duplicate column)
        if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'ER_TABLE_EXISTS_ERROR') {
          console.log(`   ℹ️  Statement ${i + 1} skipped (already applied): ${error.message}`);
        } else {
          console.error(`   ❌ Error executing statement ${i + 1}:`, error.message);
          console.log(`   Statement: ${statement.substring(0, 100)}...`);
        }
      }
    }

    console.log('\n🎉 Migration completed!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

runMigrations().catch(console.error);
