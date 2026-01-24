import { Client } from 'pg';
import 'dotenv/config';

// Usage: npx tsx scripts/set_prod_vault_secrets.ts <project_url> <anon_key>
// Or set ENV vars: PROD_SUPABASE_DB_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

async function main() {
    console.log("🔐 Setting Production Vault Secrets...");

    const args = process.argv.slice(2);
    const projectUrl = args[0] || process.env.VITE_SUPABASE_URL;
    const anonKey = args[1] || process.env.VITE_SUPABASE_ANON_KEY;
    const databaseUrl = process.env.PROD_SUPABASE_DB_URL;
    //OPENROUTER_API_KEY and OPENROUTER_MODEL
    const openrouterApiKey = args[2] || process.env.OPENROUTER_API_KEY;
    const openrouterModel = args[3] || process.env.OPENROUTER_MODEL;


    if (!databaseUrl) {
        console.error("❌ Error: PROD_SUPABASE_DB_URL is not set in .env");
        process.exit(1);
    }

    if (!projectUrl || !anonKey) {
        console.error("❌ Error: Missing project URL or Anon Key.");
        console.error("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env or pass as arguments.");
        process.exit(1);
    }

    if (!openrouterApiKey || !openrouterModel) {
        console.error("❌ Error: Missing OpenRouter API Key or Model.");
        console.error("Set OPENROUTER_API_KEY and OPENROUTER_MODEL in .env or pass as arguments.");
        process.exit(1);
    }

    const client = new Client({
        connectionString: databaseUrl,
        ssl: {
            rejectUnauthorized: false // Required for Supabase remote connections
        }
    });

    try {
        await client.connect();
        console.log("✅ Connected to Production Database.");

        // Clean up existing if they exist (to ensure fresh update)
        console.log("🧹 Cleaning up old secrets...");
        await client.query("delete from vault.secrets where name in ('project_url', 'anon_key')");

        // 1. Set project_url
        console.log(`Setting secret: project_url`);
        await client.query(`
            select vault.create_secret($1, 'project_url', 'Project URL for AI Engine');
        `, [projectUrl]);

        // 2. Set anon_key
        console.log(`Setting secret: anon_key`);
        await client.query(`
            select vault.create_secret($1, 'anon_key', 'Anon Key for AI Engine');
        `, [anonKey]);

        // 3. Set openrouter_api_key
        console.log(`Setting secret: openrouter_api_key`);
        await client.query(`
            select vault.create_secret($1, 'openrouter_api_key', 'OpenRouter API Key for AI Engine');
        `, [openrouterApiKey]);

        // 4. Set openrouter_model
        console.log(`Setting secret: openrouter_model`);
        await client.query(`
            select vault.create_secret($1, 'openrouter_model', 'OpenRouter Model for AI Engine');
        `, [openrouterModel]);

        console.log("✅ Production Secrets set successfully in Vault.");

    } catch (err: any) {
        console.error("❌ Database Error:", err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

main();
