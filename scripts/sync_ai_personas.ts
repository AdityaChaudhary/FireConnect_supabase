import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import * as sharpLib from 'sharp';
const sharp = (sharpLib as any).default || sharpLib;
import { SingleBar, Presets } from 'cli-progress';
import 'dotenv/config';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("⚠️ SUPABASE_SERVICE_ROLE_KEY is missing. Auth sync will fail.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || '', {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const JSON_DB_PATH = join(process.cwd(), 'scripts', 'ai-users.json');
const REDDIT_FOLDER = join(process.cwd(), 'reddit', 'output_folder');
const PROCESSED_IMAGES_DIR = join(process.cwd(), 'scripts', 'processed_images');

const IMAGE_AVATAR_QUALITY = 50;
const IMAGE_QUALITY = 65;
const IMAGE_BLURRED_QUALITY = 30;

// Types
interface AIUserRecord {
    folderName: string;
    uid?: string;
    email?: string;
    username: string;
    displayName: string;
    bio: string;
    persona: string;
    gender: string;
    location: string;
    latitude?: number;
    longitude?: number;
    dateOfBirth: string;
    interests: string[];
    createdAt: string;
    profilePictureUrl?: string;
}

// Helpers
function loadAIUsers(): Record<string, AIUserRecord> {
    if (existsSync(JSON_DB_PATH)) {
        return JSON.parse(readFileSync(JSON_DB_PATH, 'utf-8'));
    }
    return {};
}

function saveAIUsers(users: Record<string, AIUserRecord>) {
    writeFileSync(JSON_DB_PATH, JSON.stringify(users, null, 2));
}

function sanitizeMediaFileName(fileName: string): string {
    return fileName
        .replace(/[?#]/g, '') // Keep existing basic sanitization
        .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters (like ellipsis, smart quotes)
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .replace(/[^a-zA-Z0-9.-]/g, '_'); // Replace any other unsafe characters with underscores
}

async function askQuestion(query: string): Promise<string> {
    const readline = await import('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}

// Step 1: Auth Sync
async function syncAuth(users: Record<string, AIUserRecord>) {
    console.log("\n--- [Step 1] Syncing to Supabase Auth ---");
    // 1. Pre-fetch all existing users to avoid O(n) API calls inside the loop
    let existingUsers: any[] = [];
    try {
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({
            perPage: 1000
        });
        if (listError) throw listError;
        existingUsers = users;
    } catch (e: any) {
        console.warn(`\n⚠️ Warning: Could not fetch existing users: ${e.message}. Will attempt to create all.`);
    }

    const userList = Object.values(users);
    const progressBar = new SingleBar({
        format: 'Auth Sync |{bar}| {percentage}% | {value}/{total} | {user} | {status}',
        hideCursor: true
    }, Presets.shades_classic);
    progressBar.start(userList.length, 0, { user: 'Starting', status: 'Init' });

    for (const record of userList) {
        const email = record.email || `${record.username.toLowerCase()}@ai.fireconnect.com`;
        const password = "Password123!@#AI_PERSONA";

        try {
            const existingUser = existingUsers.find(u => u.email === email);
            
            if (existingUser) {
                record.uid = existingUser.id;
                record.email = email;
                progressBar.increment(1, { user: record.username, status: 'Existing' });
            } else {
                const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                    email,
                    password,
                    email_confirm: true,
                    user_metadata: { display_name: record.displayName }
                });

                if (createError) throw createError;
                if (newUser.user) {
                    record.uid = newUser.user.id;
                    record.email = email;
                    progressBar.increment(1, { user: record.username, status: 'Created' });
                }
            }
        } catch (e: any) {
            progressBar.increment(1, { user: record.username, status: 'Error' });
            console.error(`\nError syncing auth for ${record.username}: ${e.message}`);
        }
    }
    progressBar.stop();
    saveAIUsers(users);
}

// Step 2 & 3: Image Processing & Storage Sync
async function syncMedia(users: Record<string, AIUserRecord>) {
    console.log("\n--- [Step 2 & 3] Processing & Uploading Media ---");
    if (!existsSync(PROCESSED_IMAGES_DIR)) mkdirSync(PROCESSED_IMAGES_DIR, { recursive: true });

    const userList = Object.values(users).filter(u => u.uid);
    const progressBar = new SingleBar({
        format: 'Media Sync |{bar}| {percentage}% | {value}/{total} | {user} | {status}',
        hideCursor: true
    }, Presets.shades_classic);
    progressBar.start(userList.length, 0, { user: 'Starting', status: 'Init' });

    for (const record of userList) {
        const uid = record.uid!;
        const folderPath = join(REDDIT_FOLDER, record.folderName);
        if (!existsSync(folderPath)) {
            progressBar.increment(1, { user: record.username, status: 'Folder Missing' });
            continue;
        }

        const files = readdirSync(folderPath)
            .filter(f => f.toLowerCase().match(/\.(jpg|jpeg|png)$/))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
        
        // Optimize: List existing files in storage once per user per bucket to avoid many list calls
        const listFiles = async (bucket: string, path: string) => {
            const { data, error } = await supabase.storage.from(bucket).list(path, { limit: 100 });
            if (error) return [];
            return data?.map(f => f.name) || [];
        };

        const existingPublicShared = await listFiles('public-media', `users/${uid}/shared/PUBLIC`);
        const existingPrivateShared = await listFiles('private-media', `users/${uid}/shared/PRIVATE`);
        const existingBlurred = await listFiles('public-media', `users/${uid}/shared/PUBLIC/blurred`);
        const existingAvatars = await listFiles('public-media', `users/${uid}/avatars`);

        for (let i = 0; i < files.length; i++) {
            const fileName = files[i];
            const sanitizedFileName = sanitizeMediaFileName(fileName);
            const filePath = join(folderPath, fileName);
            const isProfile = i === 0;
            const visibility = isProfile ? 'PUBLIC' : 'PRIVATE';
            const bucket = isProfile || visibility === 'PUBLIC' ? 'public-media' : 'private-media';
            
            const storagePath = `users/${uid}/shared/${visibility}/${sanitizedFileName}`;
            const avatarPath = `users/${uid}/avatars/${sanitizedFileName}`;

            try {
                const fileBuffer = readFileSync(filePath);

                // 1. Process and Upload Main Image
                const currentList = visibility === 'PUBLIC' ? existingPublicShared : existingPrivateShared;
                if (!currentList.includes(sanitizedFileName)) {
                    const processed = await sharp(fileBuffer)
                        .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
                        .jpeg({ quality: IMAGE_QUALITY })
                        .toBuffer();
                    
                    const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, processed, { contentType: 'image/jpeg', upsert: true });
                    if (uploadError) throw new Error(`Upload failed for ${storagePath}: ${uploadError.message}`);
                }

                // 2. Blurred version for private
                if (visibility === 'PRIVATE') {
                    const blurredFileName = `blurred_${sanitizedFileName}`;
                    const blurredPath = `users/${uid}/shared/PUBLIC/blurred/${blurredFileName}`;
                    
                    if (!existingBlurred.includes(blurredFileName)) {
                        const blurred = await sharp(fileBuffer)
                            .blur(50)
                            .jpeg({ quality: IMAGE_BLURRED_QUALITY })
                            .toBuffer();
                        const { error: uploadError } = await supabase.storage.from('public-media').upload(blurredPath, blurred, { contentType: 'image/jpeg', upsert: true });
                        if (uploadError) throw new Error(`Blurred upload failed for ${blurredPath}: ${uploadError.message}`);
                    }
                }

                // 3. Avatar for first image
                if (isProfile) {
                    if (!existingAvatars.includes(sanitizedFileName)) {
                        const avatar = await sharp(fileBuffer)
                            .resize({ width: 512, height: 512, fit: 'cover' })
                            .jpeg({ quality: IMAGE_AVATAR_QUALITY })
                            .toBuffer();
                        const { error: uploadError } = await supabase.storage.from('public-media').upload(avatarPath, avatar, { contentType: 'image/jpeg', upsert: true });
                        if (uploadError) throw new Error(`Avatar upload failed for ${avatarPath}: ${uploadError.message}`);
                    }
                    record.profilePictureUrl = avatarPath;
                }
            } catch (e: any) {
                console.error(`\nError processing ${fileName} for ${record.username}: ${e.message}`);
                // Re-throw to stop the sync if it's a storage failure
                throw e;
            }
        }
        progressBar.increment(1, { user: record.username, status: 'Media Done' });
    }
    progressBar.stop();
    saveAIUsers(users);
}

// Step 4: Database Sync
async function syncDatabase(users: Record<string, AIUserRecord>) {
    console.log("\n--- [Step 4] Syncing to Postgres ---");
    const userList = Object.values(users).filter(u => u.uid);
    const progressBar = new SingleBar({
        format: 'DB Sync |{bar}| {percentage}% | {value}/{total} | {user} | {status}',
        hideCursor: true
    }, Presets.shades_classic);
    progressBar.start(userList.length, 0, { user: 'Starting', status: 'Init' });

    for (const record of userList) {
        try {
            // Upsert User
            const { error: userError } = await supabase.from('users').upsert({
                id: record.uid,
                username: record.username,
                display_name: record.displayName,
                email: record.email,
                bio: record.bio,
                persona: record.persona,
                profile_picture_url: record.profilePictureUrl,
                gender: record.gender,
                location: record.location,
                latitude: record.latitude,
                longitude: record.longitude,
                interests: record.interests,
                user_type: 'AI',
                date_of_birth: record.dateOfBirth,
                is_onboarded: true
            });

            if (userError) throw userError;

            // Upsert Profile Images
            const folderPath = join(REDDIT_FOLDER, record.folderName);
            if (existsSync(folderPath)) {
                const files = readdirSync(folderPath)
                    .filter(f => f.toLowerCase().match(/\.(jpg|jpeg|png)$/))
                    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
                const imageInserts = files.map((fileName, i) => {
                    const sanitizedFileName = sanitizeMediaFileName(fileName);
                    const isProfile = i === 0;
                    const visibility = isProfile ? 'PUBLIC' : 'PRIVATE';
                    const prefix = `users/${record.uid}/`;
                    return {
                        user_id: record.uid,
                        url: `${prefix}${visibility === 'PUBLIC' ? 'shared/PUBLIC' : 'shared/PRIVATE'}/${sanitizedFileName}`,
                        blurred_url: visibility === 'PRIVATE' ? `${prefix}shared/PUBLIC/blurred/blurred_${sanitizedFileName}` : null,
                        is_profile: isProfile,
                        display_order: i,
                        visibility: visibility
                    };
                });

                const { error: imgError } = await supabase.from('profile_images').upsert(imageInserts, { onConflict: 'user_id, url' });
                // Note: onConflict composite key might need adjustment based on schema
                if (imgError) {
                    // Fallback to individual upserts if composite conflict fails
                    for (const img of imageInserts) {
                        await supabase.from('profile_images').upsert(img, { onConflict: 'user_id, url' });
                    }
                }
            }
            progressBar.increment(1, { user: record.username, status: 'DB Success' });
            // Add a small delay to reduce DB pressure
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (e: any) {
            progressBar.increment(1, { user: record.username, status: 'Error' });
            console.error(`\nError syncing DB for ${record.username}: ${e.message}`);
        }
    }
    progressBar.stop();
}

// Step 5: SQL Seed Generation (REMOVED - Use Step 4 instead)

// Step 6: Reset Metadata
async function resetMetadata(users: Record<string, AIUserRecord>) {
    console.log("\n--- [Step 6] Resetting Metadata (UID & profilePictureUrl) ---");
    const confirm = await askQuestion("Are you sure you want to clear all UIDs and Profile Picture URLs in ai-users.json? (y/N): ");
    if (confirm.toLowerCase() !== 'y') {
        console.log("Aborted.");
        return;
    }

    for (const record of Object.values(users)) {
        delete record.uid;
        delete record.profilePictureUrl;
    }
    saveAIUsers(users);
    console.log("✅ Metadata reset complete in ai-users.json");
}

async function main() {
    console.log("\n🚀 AI Persona Sync Tool");
    const users = loadAIUsers();

    if (Object.keys(users).length === 0) {
        console.error("❌ No users found in ai-users.json. Run generate_ai_personas.ts first.");
        process.exit(1);
    }

    console.log("\n--- Select Operation ---");
    console.log("1. Sync ALL (Auth -> Media -> DB -> Seed)");
    console.log("2. Sync Auth only");
    console.log("3. Sync Media only");
    console.log("4. Sync Database only");
    console.log("5. Generate Seed SQL only");
    console.log("6. Reset Metadata (Clear UIDs & Paths)");

    const choice = await askQuestion("\nSelect an option (1-6): ");

    try {
        switch (choice) {
            case '1':
                await syncAuth(users);
                await syncMedia(users);
                await syncDatabase(users);
                // await generateSeedData(users);
                break;
            case '2': await syncAuth(users); break;
            case '3': await syncMedia(users); break;
            case '4': await syncDatabase(users); break;
            // case '5': await generateSeedData(users); break;
            case '6': await resetMetadata(users); break;
            default: console.log("Invalid option."); break;
        }
    } catch (e: any) {
        console.error("\n❌ Fatal Error:", e.message);
    }

    console.log("\n✅ Done.");
    process.exit(0);
}

main().catch(err => {
    console.error("Fatal Error:", err);
    process.exit(1);
});
