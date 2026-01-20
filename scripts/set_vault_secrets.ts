import { Client } from 'pg';
import 'dotenv/config';

// Usage: npx tsx scripts/set_vault_secrets.ts <project_url> <anon_key>
// Or set ENV vars: SUPABASE_DB_URL, PROJECT_URL, ANON_KEY

const DATABASE_URL = process.env.SUPABASE_DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

async function main() {
    console.log("🔐 Setting Vault Secrets...");

    const args = process.argv.slice(2);
    const projectUrl = args[0] || process.env.PROJECT_URL;
    const anonKey = args[1] || process.env.ANON_KEY;

    if (!projectUrl || !anonKey) {
        console.error("❌ Error: Missing required arguments.");
        console.error("Usage: npx tsx scripts/set_vault_secrets.ts <project_url> <anon_key>");
        process.exit(1);
    }

    const client = new Client({
        connectionString: DATABASE_URL,
    });

    try {
        await client.connect();

        // 1. Set project_url
        console.log(`Setting secret: project_url = ${projectUrl}`);
        await client.query(`
            select vault.create_secret($1, 'project_url', 'Project URL for AI Engine');
        `, [projectUrl]);

        // 2. Set anon_key
        console.log(`Setting secret: anon_key = [HIDDEN]`);
        await client.query(`
            select vault.create_secret($1, 'anon_key', 'Anon Key for AI Engine');
        `, [anonKey]);

        console.log("✅ Secrets set successfully in Vault.");

    } catch (err: any) {
        if (err.code === '23505') { // Unique violation
             console.log("⚠️ Secrets already exist. Updating...");
             // Update logic if needed, or just inform user. Vault usually requires ID to update.
             // We can try to update by name if we really wanted to, but secrets are usually immutable or key-based.
             // But valid `create_secret` might fail if name exists? 
             // Actually `create_secret` usually returns the UUID.
             // If we really want to upsert, we might need a different function or delete and recreate.
             // For now, let's try to delete and recreate if it fails?
             
             // Simple approach: Delete existing secrets with these names first to ensure fresh values.
              try {
                console.log("   Deleting old secrets to ensure update...");
                await client.query("delete from vault.secrets where name in ('project_url', 'anon_key')");
                
                // Retry creation
                await client.query(`select vault.create_secret($1, 'project_url', 'Project URL for AI Engine');`, [projectUrl]);
                await client.query(`select vault.create_secret($1, 'anon_key', 'Anon Key for AI Engine');`, [anonKey]);
                console.log("✅ Secrets updated successfully.");
             } catch (retryErr: any) {
                 console.error("❌ Failed to update secrets:", retryErr.message);
             }

        } else {
            console.error("❌ Database Error:", err.message);
        }
    } finally {
        await client.end();
    }
}

main();
