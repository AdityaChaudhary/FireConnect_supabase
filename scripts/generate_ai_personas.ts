import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import * as readline from 'readline';
import { SingleBar, Presets } from 'cli-progress';
import { AVAILABLE_INTERESTS } from '../lib/config';
import 'dotenv/config';

// Configuration
const GEMINI_API_KEY = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY or GOOGLE_GENAI_API_KEY is missing in environment.");
    process.exit(1);
}

const ai = genkit({
    plugins: [googleAI({ apiKey: GEMINI_API_KEY })],
    model: googleAI.model('gemini-2.0-flash-lite'),
});

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callAIWithRetry(params: any, maxRetries = 3) {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            const response = await ai.generate(params);
            return response;
        } catch (error: any) {
            if (error.status === 'RESOURCE_EXHAUSTED' || error.code === 429) {
                const waitTime = Math.pow(2, retries) * 1000 + Math.random() * 1000;
                console.log(`\n⚠️ Rate limit hit. Waiting ${Math.round(waitTime/1000)}s before retry...`);
                await delay(waitTime);
                retries++;
            } else {
                throw error;
            }
        }
    }
    throw new Error(`Failed after ${maxRetries} retries due to quota limits.`);
}

const JSON_DB_PATH = join(process.cwd(), 'scripts', 'ai-users.json');
const REDDIT_FOLDER = join(process.cwd(), 'reddit', 'output_folder');

// Types
enum Gender {
    MALE = 'MALE',
    FEMALE = 'FEMALE',
    OTHER = 'OTHER',
    PREFER_NOT_TO_SAY = 'PREFER_NOT_TO_SAY'
}

const PersonaSchema = z.object({
    username: z.string(),
    displayName: z.string(),
    bio: z.string(),
    persona: z.string(),
    gender: z.nativeEnum(Gender),
    location: z.string(),
    latitude: z.number(),
    longitude: z.number(),
    dateOfBirth: z.string(),
    interests: z.array(z.string()),
});

interface AIUserRecord {
    folderName: string;
    uid?: string;
    email?: string;
    username: string;
    displayName: string;
    bio: string;
    persona: string;
    gender: Gender;
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

async function askQuestion(query: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}

async function generatePersona(hint: string) {
    console.log(`Generating persona for hint: ${hint}...`);
    const response = await callAIWithRetry({
        prompt: `Generate a seductive and hot persona for a female AI character. 
        Base it loosely on this hint: "${hint}". 
        The character should be open to new adult adventures.
        
        Available Interests (pick between 0 to 5 from this list):
        ${AVAILABLE_INTERESTS.join(', ')}

        Provide:
        1. username: a creative sexy username, single word, without space or special characters. Be super creative with this.
        2. displayName: a beautiful display name. Make it similar to username.
        3. bio: a seductive bio reflecting her personality and openness to adult adventures. Bio should not mention that the user is AI.
        4. persona: a detailed internal persona description for the AI to follow
        5. gender: Always female
        6. location: a realistic city and country (choose a major city in the US, UK, Australia, New Zealand, Canada, or Europe)
        7. latitude: the approximate latitude of the chosen city
        8. longitude: the approximate longitude of the chosen city
        9. dateOfBirth: a realistic date of birth in YYYY-MM-DD format for a person aged between 19 and 30
        10. interests: between 0 to 5 interests selected from the list above`,
        output: {
            schema: PersonaSchema,
        },
    });

    if (response.output) {
        return response.output;
    }
    throw new Error("Failed to generate structured persona via Genkit");
}

async function regenerateAIUserData(existingUsers: Record<string, AIUserRecord>, fieldsToUpdate: (keyof AIUserRecord)[]) {
    console.log(`\n--- Regenerating fields: [${fieldsToUpdate.join(', ')}] ---`);
    const users = Object.entries(existingUsers);
    const progressBar = new SingleBar({
        format: 'Regenerating |{bar}| {percentage}% | {value}/{total} | {user} | {status}',
        hideCursor: true
    }, Presets.shades_classic);
    progressBar.start(users.length, 0, { user: 'Starting', status: 'Init' });

    for (const [folder, record] of users) {
        const hint = folder.split('_')[0] || folder;
        try {
            // Add a base delay between requests to avoid hitting limits immediately
            //await delay(500);

            const response = await callAIWithRetry({
                prompt: `Regenerate specific fields for a female AI character. 
                Keep it consistent with her current identity:
                - Username: ${record.username}
                - Display Name: ${record.displayName}
                
                Base it loosely on this hint: "${hint}". 
                The character should be open to new adult adventures.
                
                Available Interests (pick between 0 to 5 from this list):
                ${AVAILABLE_INTERESTS.join(', ')}

                Provide UPDATED values for these fields: ${fieldsToUpdate.join(', ')}.
                Fields not mentioned should be kept consistent with her persona.`,
                output: {
                    schema: PersonaSchema,
                },
            });

            if (response.output) {
                const details = response.output;
                for (const field of fieldsToUpdate) {
                    if (field in details) {
                        (record as any)[field] = (details as any)[field];
                    }
                }
                progressBar.increment(1, { user: record.username, status: 'Updated' });
            } else {
                throw new Error("No output from AI");
            }
        } catch (e: any) {
            progressBar.increment(1, { user: record.username, status: 'Error' });
            console.error(`\nError regenerating for ${record.username}: ${e.message}`);
        }
    }
    progressBar.stop();
    saveAIUsers(existingUsers);
    console.log("✅ Data regeneration complete.");
}

async function main() {
    console.log("\n🚀 AI Persona Generator");

    if (!existsSync(REDDIT_FOLDER)) {
        console.error(`❌ Reddit folder not found at: ${REDDIT_FOLDER}`);
        process.exit(1);
    }

    console.log("\n--- Select Operation ---");
    console.log("1. Generate New Personas (Sync from folder)");
    console.log("2. Regenerate Specific Fields (All users)");
    console.log("3. List Current Personas");

    const choice = await askQuestion("\nSelect an option (1-3): ");
    const existingUsers = loadAIUsers();

    try {
        switch (choice) {
            case '1': {
                const folders = readdirSync(REDDIT_FOLDER).filter(f => !f.startsWith('.') && f !== 'processed');
                const results: Record<string, AIUserRecord> = { ...existingUsers };

                const progressBar = new SingleBar({
                    format: 'Persona Gen |{bar}| {percentage}% | {value}/{total} | {user} | {status}',
                    hideCursor: true
                }, Presets.shades_classic);
                progressBar.start(folders.length, 0, { user: 'Starting', status: 'Init' });

                for (const folder of folders) {
                    if (existingUsers[folder]) {
                        progressBar.increment(1, { user: existingUsers[folder].username, status: 'Cached' });
                        continue;
                    }
                    const hint = folder.split('_')[0] || folder;
                    try {
                        const details = await generatePersona(hint);
                        results[folder] = {
                            folderName: folder,
                            username: details.username,
                            displayName: details.displayName,
                            bio: details.bio,
                            persona: details.persona,
                            gender: details.gender as Gender,
                            location: details.location,
                            latitude: details.latitude,
                            longitude: details.longitude,
                            dateOfBirth: details.dateOfBirth,
                            interests: details.interests,
                            createdAt: new Date().toISOString()
                        };
                        progressBar.increment(1, { user: details.username, status: 'Generated' });
                    } catch (e: any) {
                        progressBar.increment(1, { user: folder, status: 'Error' });
                        console.error(`\nError generating for ${folder}: ${e.message}`);
                    }
                }
                progressBar.stop();
                saveAIUsers(results);
                console.log(`\n✅ Generated/Updated personas in: ${JSON_DB_PATH}`);
                break;
            }
            case '2': {
                console.log("\nWhich fields should be regenerated? (comma separated)");
                console.log("Values: bio, persona, location, interests, dateOfBirth");
                const fieldsInput = await askQuestion("Fields: ");
                const fields = fieldsInput.split(',').map(f => f.trim()) as (keyof AIUserRecord)[];
                
                const validFields = ['bio', 'persona', 'location', 'interests', 'dateOfBirth'];
                const filteredFields = fields.filter(f => validFields.includes(f as string));

                if (filteredFields.length === 0) {
                    console.log("No valid fields selected.");
                    break;
                }

                const confirm = await askQuestion(`Are you sure you want to regenerate [${filteredFields.join(', ')}] for ALL users? (y/N): `);
                if (confirm.toLowerCase() === 'y') {
                    await regenerateAIUserData(existingUsers, filteredFields);
                }
                break;
            }
            case '3': {
                const users = Object.values(existingUsers);
                console.log(`\nTotal Personas: ${users.length}`);
                users.forEach((u, i) => console.log(`${i+1}. ${u.username} (${u.displayName}) - ${u.folderName}`));
                break;
            }
            default:
                console.log("Invalid option.");
                break;
        }
    } catch (error: any) {
        console.error("\n❌ ERROR:", error.message);
    }

    console.log("\n✅ Done.");
    process.exit(0);
}

main().catch(err => {
    console.error("Fatal Error:", err);
    process.exit(1);
});
