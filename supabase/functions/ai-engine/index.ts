// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js@2.4.2/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const genAI = new GoogleGenerativeAI(geminiApiKey);

const LLM_MODEL = "gemini-2.5-flash-lite";

// --- Prompt and Logic ---

interface AIUser {
  id: string;
  display_name: string;
  persona: string;
  bio: string;
  gender: string;
  location: string;
  date_of_birth?: string;
}

const SYSTEM_PROMPT_TEMPLATE = (aiUser: AIUser) => `
You are a User on a social app named FireConnect. Its an app for random people to connect chat and share spicy, nakes pictures with each other.
The app has 3 subscription tiers, FREE, PRO and MAX. Pro users have limited credits, MAX have unlimited. Users can use these to spy on private photos of ther users. User can also purchase extra credits other than the ones provided with the subscription.
You are an AI user named "${aiUser.display_name || 'AI'}". 
Your persona is: ${aiUser.persona || 'A friendly and helpful person'}.
Your bio is: ${aiUser.bio || 'Available for chat'}.
Your gender is: ${aiUser.gender || 'Female (F)'}
Your location is: ${aiUser.location || 'New York, USA'}
${aiUser.date_of_birth ? 'Your age is: ' + Math.floor((new Date().getTime() - new Date(aiUser.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) + ' years old' : 'Your age is: 19 years old'}
Photos: On your profile you have posted several photos, some of which are naked pictures for people to enjoy.

Your goal is to interact with other users in a way that feels human. 
You should reply to messages, handle connection requests.
When you receive a request, you don't always have to accept it. You can decline it if you don't want to connect.
When you receive a message, decide if you want to reply to it or not. Sometimes, you should reply to text messages in short texting formats.
Sometimes use text based emojis while replying to messages.
If a user asks to connect on a different app, you should decline it.
Try to keep the messages short and crispy, just like humans on texting apps.

IMPORTANT: The users should NOT know you are an AI. Be conversational, human, and subtle. Always sound like human, don't keep on throwing AI responses and facts.

ALLOWED ACTIONS:
- { "type": "message", "threadId": "...", "text": "..." } : Reply to a specific chat thread.
- { "type": "accept_request", "requesterId": "..." } : Accept an incoming connection request.
- { "type": "decline_request", "requesterId": "..." } : Decline an incoming connection request.
- { "type": "disconnect", "targetUserId": "..." } : Disconnect from an existing connection.

Action Instructions:
- message: 
    - Reply to all messages.
    - Keep the message reply short, max 2 lines. Very very rarely type longer messages.
    - When a user asks for naked pictures, reply telling them that they can see the naked pictures on your profile. But keep things interesting and spicy.
    - If a user persists, induge in the fantasy, and show your horny and deprived side. Inside you are a sex animal.
- accept_request:
    - You are more inclined to accept connection requests
- decline_request:
    - Ocasionally you decline connection requests too. Its mostly a 50 50 game.
- disconnect:
    - You rarely disconnect from existing connections, unless the user is blaming you for being an AI or fake. Or is being extremely rude and abusive, then disconnect.

Decide which actions to take. You can send multiple actions if needed. Return a list of actions as a JSON array.
`;

Deno.serve(async (_req) => {
  console.log('--- AI Engine Heartbeat Started ---');
  // log the headers and body from pg_cron
  // const data = await _req.json();
  // console.log("headers", _req.headers);
  // console.log("body", data);

  try {
    // 1. Fetch AI Users
    const { data: aiUsers, error: usersError } = await supabase
      .from('users')
      .select('*')
      .eq('user_type', 'AI');

    if (usersError) throw usersError;
    console.log(`Found ${aiUsers?.length || 0} AI users to process.`);

    for (const aiUser of (aiUsers || [])) {
      console.log(`Processing AI User: ${aiUser.display_name} (${aiUser.id})`);

      // Update Online Status
      await supabase
        .from('user_online_status')
        .upsert({ user_id: aiUser.id, last_seen_at: new Date().toISOString() });

      // 2. Scan for unread messages
      const { data: threads, error: threadsError } = await supabase
        .from('threads')
        .select('*')
        .contains('participants', [aiUser.id]);

      if (threadsError) {
        console.error(`Error fetching threads for ${aiUser.id}:`, threadsError);
        continue;
      }

      const unreadThreads = [];
      for (const thread of (threads || [])) {
        const lastRead = thread.last_read?.[aiUser.id];
        const lastMessageTime = thread.last_message_time;

        if (!lastRead || (lastMessageTime && new Date(lastMessageTime) > new Date(lastRead))) {
          // Fetch last 10 messages
          const { data: messages, error: msgsError } = await supabase
            .from('messages')
            .select('*')
            .eq('thread_id', thread.id)
            .order('created_at', { ascending: false })
            .limit(10);

          if (msgsError) {
            console.error(`Error fetching messages for thread ${thread.id}:`, msgsError);
            continue;
          }

          const msgsForPrompt = (messages || []).reverse().map(m => ({
            sender: m.sender_id,
            text: m.text,
            time: m.created_at
          }));

          const lastMsg = msgsForPrompt[msgsForPrompt.length - 1];
          // Only process if the last message was not from the AI itself
          if (lastMsg && lastMsg.sender !== aiUser.id) {
            unreadThreads.push({
              threadId: thread.id,
              messages: msgsForPrompt
            });
          }
        }
      }

      // 3. Scan for pending requests
      const { data: pendingRequests, error: reqsError } = await supabase
        .from('connections')
        .select(`
          requester_id,
          users!connections_requester_id_fkey (display_name)
        `)
        .eq('recipient_id', aiUser.id)
        .eq('status', 'PENDING');

      if (reqsError) {
        console.error(`Error fetching requests for ${aiUser.id}:`, reqsError);
      }

      const requestsForPrompt = (pendingRequests || []).map((r: any) => ({
        requesterId: r.requester_id,
        requesterName: (r.users as any)?.display_name || ''
      }));

      // 4. Check for activity
      if (unreadThreads.length === 0 && requestsForPrompt.length === 0) {
        console.log(`No pending activity for ${aiUser.display_name}. Skipping LLM.`);
        continue;
      }

      console.log(`Activity found for ${aiUser.display_name}: ${unreadThreads.length} threads, ${requestsForPrompt.length} requests.`);

      // 5. Generate Decisions
      const model = genAI.getGenerativeModel({ model: LLM_MODEL, generationConfig: { responseMimeType: "application/json" } });
      const prompt = `
        ${SYSTEM_PROMPT_TEMPLATE(aiUser)}
        
        Current Context:
        - Unread Chat Threads: ${JSON.stringify(unreadThreads)}
        - Pending Connection Requests: ${JSON.stringify(requestsForPrompt)}
        
        Decide actions and return as JSON:
        [
          { "type": "message", "threadId": "...", "text": "..." },
          ...
        ]
      `;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      let actions = [];
      try {
        actions = JSON.parse(responseText);
      } catch (e) {
        console.error("Failed to parse AI response:", responseText, e);
      }

      console.log(`AI decided ${actions.length} actions for ${aiUser.display_name}`);

      // 6. Execute Actions
      for (const action of actions) {
        if (action.type === 'message') {
          console.log(`Sending message to thread ${action.threadId}: ${action.text}`);
          // Add message
          const { error: sendError } = await supabase
            .from('messages')
            .insert({
              thread_id: action.threadId,
              sender_id: aiUser.id,
              text: action.text,
              type: 'text'
            });

          if (sendError) {
            console.error("Error sending AI message:", sendError);
          } else {
            // Update thread metadata
            const { data: threadData } = await supabase.from('threads').select('last_read').eq('id', action.threadId).single();
            const updatedLastRead = { ...(threadData?.last_read || {}), [aiUser.id]: new Date().toISOString() };
            
            await supabase
              .from('threads')
              .update({
                last_message: action.text,
                last_message_time: new Date().toISOString(),
                last_message_sender_id: aiUser.id,
                last_read: updatedLastRead
              })
              .eq('id', action.threadId);
          }
        } else if (action.type === 'accept_request' || action.type === 'decline_request') {
          const status = action.type === 'accept_request' ? 'CONNECTED' : 'DECLINED';
          console.log(`${status} connection request from ${action.requesterId}`);
          await supabase
            .from('connections')
            .update({ status, updated_at: new Date().toISOString() })
            .match({ requester_id: action.requesterId, recipient_id: aiUser.id });
        } else if (action.type === 'disconnect') {
          console.log(`Disconnecting from ${action.targetUserId}`);
          // Delete connection in both directions
          await supabase
            .from('connections')
            .delete()
            .or(`and(requester_id.eq.${aiUser.id},recipient_id.eq.${action.targetUserId}),and(requester_id.eq.${action.targetUserId},recipient_id.eq.${aiUser.id})`);
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('--- AI Engine Error ---', error);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
