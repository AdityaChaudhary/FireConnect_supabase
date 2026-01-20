import { Client } from 'pg';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import 'dotenv/config';

// Usage: npx tsx scripts/apply_prod_migration.ts <migration_file_path>
// Example: npx tsx scripts/apply_prod_migration.ts supabase/migrations/20260120000000_setup_ai_engine_cron.sql

async function main() {
    const args = process.argv.slice(2);
    const migrationFile = args[0];
    const databaseUrl = process.env.PROD_SUPABASE_DB_URL;

    if (!migrationFile) {
        console.error("❌ Error: No migration file specified.");
        console.error("Usage: npx tsx scripts/apply_prod_migration.ts <migration_file_path>");
        process.exit(1);
    }

    if (!databaseUrl) {
        console.error("❌ Error: PROD_SUPABASE_DB_URL is not set in .env");
        process.exit(1);
    }

    const fullPath = join(process.cwd(), migrationFile);
    if (!existsSync(fullPath)) {
        console.error(`❌ Error: File not found at ${fullPath}`);
        process.exit(1);
    }

    console.log(`🛠️ Applying migration to Production: ${migrationFile}`);

    const client = new Client({
        connectionString: databaseUrl,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        await client.connect();
        console.log("✅ Connected to Production Database.");

        const sql = readFileSync(fullPath, 'utf-8');
        
        // Execute the migration SQL
        await client.query(sql);
        console.log("✅ Migration executed successfully on Production.");

    } catch (err: any) {
        console.error("❌ Database Error:", err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

main();
