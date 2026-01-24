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
    const stripe_wrapper_api_key_id = args[2] || process.env.STRIPE_WRAPPER_API_KEY_ID;

    if (!projectUrl || !anonKey || !stripe_wrapper_api_key_id) {
        console.error("❌ Error: Missing required arguments.");
        console.error("Usage: npx tsx scripts/set_vault_secrets.ts <project_url> <anon_key> <stripe_wrapper_api_key_id>");
        process.exit(1);
    }

    const client = new Client({
        connectionString: DATABASE_URL,
    });

    try {
        await client.connect();

        console.log("   Deleting old secrets to ensure update...");
        await client.query("delete from vault.secrets where name in ('project_url', 'anon_key', 'stripe_wrapper_api_key_id')");

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

        // 3. Set stripe_wrapper_api_key_id
        console.log(`Setting secret: stripe_wrapper_api_key_id = ${stripe_wrapper_api_key_id}`);

        // Update the secret for stripe_wrapper_api_key_id and then update the wrapper to set the new key
        /*
            CREATE SERVER stripe_server
            FOREIGN DATA WRAPPER stripe_wrapper
            OPTIONS (
            api_key_id %L
            );
        */

        await client.query(`
            select vault.create_secret($1, 'stripe_wrapper_api_key_id', 'Stripe API Key for FDW');
        `, [stripe_wrapper_api_key_id]);
        
        console.log(`Getting the ID for stripe_wrapper_api_key_id`)
        // fetch the ID of stripe_wrapper_api_key_id
        const v_secret_id = await client.query(`
            select id from vault.secrets where name = 'stripe_wrapper_api_key_id';
        `);

        console.log(`ID for stripe_wrapper_api_key_id: ${v_secret_id.rows[0].id}`);
        console.log(`Updating the stripe_wrapper to set the new key`)
        // Update the stripe_wrapper to set the new key
        console.log(`Updating stripe_server options...`);
        await client.query(`
            alter server stripe_server options (set api_key_id '${v_secret_id.rows[0].id}');
        `);

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
                await client.query(`select vault.create_secret($1, 'stripe_wrapper_api_key_id', 'Stripe API Key for FDW');`, [stripe_wrapper_api_key_id]);
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
