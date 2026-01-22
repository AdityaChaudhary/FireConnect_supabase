import { Client } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import 'dotenv/config';

const DATABASE_URL = process.env.SUPABASE_DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
//const MIGRATION_FILE = 'supabase/migrations/20260120000000_setup_ai_engine_cron.sql';

async function main() {
    const args = process.argv.slice(2);
    const MIGRATION_FILE = args[0];

    if(!MIGRATION_FILE) {
        console.error("❌ Error: No migration file specified.");
        console.error("Usage: npx tsx scripts/apply_local_migration.ts <migration_file_path>");
        process.exit(1);
    }

    console.log("🛠️ Applying migration:", MIGRATION_FILE);

    const client = new Client({
        connectionString: DATABASE_URL,
    });

    try {
        await client.connect();

        const sql = readFileSync(join(process.cwd(), MIGRATION_FILE), 'utf-8');
        
        // Execute the migration SQL
        await client.query(sql);
        console.log("✅ Migration executed successfully.");

        // Verify the cron job
        console.log("🔍 Verifying cron job 'ai-engine-heartbeat'...");
        const res = await client.query("select command from cron.job where jobname = 'ai-engine-heartbeat'");
        
        if (res.rows.length > 0) {
            console.log("✅ Job found.");
            console.log("Command:", res.rows[0].command);
            
            if (res.rows[0].command.includes("vault.decrypted_secrets")) {
                console.log("✅ Verification PASSED: Command uses Vault secrets.");
            } else {
                console.warn("⚠️ Verification FAILED: Command does NOT seem to use Vault secrets.");
            }
        } else {
            console.error("❌ Verification FAILED: Job not found.");
        }

    } catch (err: any) {
        console.error("❌ Database Error:", err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

main();
