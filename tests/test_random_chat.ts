import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/random-chat`;

if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const TEST_USERS = [
    { email: 'mentoring.e@gmail.com', id: '07b2a05c-246a-4514-83b9-3313855e88f6' },
    { email: 'adityachaudharyfit@gmail.com', id: '3a7c6a41-1718-4113-b504-2ec9fe8ea8e4' }
];

const TEST_PASSWORD = 'Testing123!@#';

async function getAuthToken(email: string) {
    // Reset password to known value to ensure we can login
    const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(
        TEST_USERS.find(u => u.email === email)!.id,
        { password: TEST_PASSWORD }
    );
    if (resetError) throw resetError;

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password: TEST_PASSWORD,
    });
    if (error) throw error;
    return data.session.access_token;
}

async function callEdgeFunction(token: string, action: string) {
    const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(`Edge Function Error (${action}): ${JSON.stringify(data)}`);
    }
    return data;
}

async function getPoolStatus(userId: string) {
    const { data, error } = await supabaseAdmin
        .from('random_chat_pool')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) throw error;
    return data;
}

async function cleanup() {
    console.log("Cleaning up pool...");
    await supabaseAdmin.from('random_chat_pool').delete().in('user_id', TEST_USERS.map(u => u.id));
    await supabaseAdmin.from('random_chat_skips').delete().in('user_id', TEST_USERS.map(u => u.id));
}

async function runTests() {
    try {
        console.log("--- Starting Random Chat Tests ---");
        await cleanup();

        console.log("Authenticating users...");
        const token1 = await getAuthToken(TEST_USERS[0].email);
        const token2 = await getAuthToken(TEST_USERS[1].email);

        // Test 1: Add user 1 to the queue, then user 2 to the queue, both should be added to a chat thread
        console.log("\n[Test 1] User 1 joining...");
        const res1 = await callEdgeFunction(token1, 'join');
        console.log("User 1 status:", res1.status);

        console.log("[Test 1] User 2 joining...");
        const res2 = await callEdgeFunction(token2, 'join');
        console.log("User 2 status:", res2.status, "Matched with:", res2.matched_with);

        const status1 = await getPoolStatus(TEST_USERS[0].id);
        const status2 = await getPoolStatus(TEST_USERS[1].id);

        if (status1?.status === 'MATCHED' && status1.matched_with === TEST_USERS[1].id &&
            status2?.status === 'MATCHED' && status2.matched_with === TEST_USERS[0].id) {
            console.log("✅ Test 1 Passed: Users matched successfully.");
        } else {
            console.error("❌ Test 1 Failed: Matching logic error.");
            console.log("Status 1:", status1);
            console.log("Status 2:", status2);
        }

        // Test 2: user 1 and 2 are in queue, both are matched, user 1 stops (leaves), 
        // user 2 should be shown user 1 skipped (status SEARCHING), and user 2 should be put back in the queue
        console.log("\n[Test 2] User 1 leaving...");
        await callEdgeFunction(token1, 'leave');

        const status2AfterLeave = await getPoolStatus(TEST_USERS[1].id);
        if (status2AfterLeave?.status === 'SEARCHING' && !status2AfterLeave.matched_with) {
            console.log("✅ Test 2 Passed: User 2 returned to SEARCHING status after User 1 left.");
        } else {
            console.error("❌ Test 2 Failed: User 2 not correctly re-queued.");
            console.log("Status 2:", status2AfterLeave);
        }

        // Test 3: user 1 goes back in the queue along with user 2, and user 1 matches with user 2, 
        // then user 1 skips, user 2 should be shown user 1 skipped and put user 2 back in the queue
        console.log("\n[Test 3] User 1 joining again...");
        await callEdgeFunction(token1, 'join');
        
        // Both should be matched again (since no other users in local pool usually)
        const status1_3 = await getPoolStatus(TEST_USERS[0].id);
        const status2_3 = await getPoolStatus(TEST_USERS[1].id);
        console.log("Re-match check:", status1_3?.status, status2_3?.status);

        console.log("[Test 3] User 1 skipping...");
        await callEdgeFunction(token1, 'skip');

        const status2AfterSkip = await getPoolStatus(TEST_USERS[1].id);
        if (status2AfterSkip?.status === 'SEARCHING' && !status2AfterSkip.matched_with) {
            console.log("✅ Test 3 Passed: User 2 returned to SEARCHING status after User 1 skipped.");
        } else {
            console.error("❌ Test 3 Failed: User 2 not correctly re-queued after skip.");
            console.log("Status 2:", status2AfterSkip);
        }

    } catch (error) {
        console.error("Test execution failed:", error);
    } finally {
        await cleanup();
    }
}

runTests();
