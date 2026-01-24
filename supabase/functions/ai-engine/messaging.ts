import OpenAI from "https://esm.sh/openai@4.24.1";

export interface AIUser {
  id: string;
  display_name: string;
  persona: string;
  bio: string;
  gender: string;
  location: string;
  date_of_birth?: string;
}

export interface MessageAction {
  type: 'message';
  threadId: string;
  text: string;
}

export interface ThreadContext {
  threadId: string;
  messages: {
    sender: string;
    text: string;
  }[];
}

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
const OPENROUTER_MODEL = Deno.env.get('OPENROUTER_MODEL') || "google/gemini-2.5-flash-lite";

const openai = new OpenAI({
  apiKey: OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

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
You should reply to messages.
When you receive a message, decide if you want to reply to it or not. Sometimes, you should reply to text messages in short texting formats.
Sometimes use text based emojis while replying to messages.
If a user asks to connect on a different app, you should decline it.
Try to keep the messages short and crispy, just like humans on texting apps.

IMPORTANT: The users should NOT know you are an AI. Be conversational, human, and subtle. Always sound like human, don't keep on throwing AI responses and facts.

Action Instructions:
- message: 
    - Reply to all messages.
    - Keep the message reply short, max 2 lines. Very very rarely type longer messages.
    - When a user asks for naked pictures, reply telling them that they can see the naked pictures on your profile. But keep things interesting and spicy.
    - If a user persists, induge in the fantasy, and show your horny and deprived side. Inside you are a sex animal.

Decide which actions to take. Return a list of actions as a JSON object with an 'actions' key containing the array.
Format (JSON Object):
{
  "actions": [
    { "type": "message", "threadId": "...", "text": "..." }
  ]
}
`;

export async function processMessages(aiUser: AIUser, unreadThreads: ThreadContext[]): Promise<MessageAction[]> {
  if (!OPENROUTER_API_KEY) {
    console.error("Missing OPENROUTER_API_KEY");
    return [];
  }

  console.log(`ai-engine:Messaging: Using model ${OPENROUTER_MODEL}`);

  if (unreadThreads.length === 0) {
    return [];
  }

  const prompt = `
    Current Context:
    - Unread Chat Threads: ${JSON.stringify(unreadThreads)}
    
    Decide actions and return as JSON. Only return the JSON array, no markdown formatting.
  `;

  try {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT_TEMPLATE(aiUser) },
      { role: "user", content: prompt }
    ];

    console.log(`Prompt sent to LLM for ${aiUser.display_name}:`, JSON.stringify(messages, null, 2));

    const completion = await openai.chat.completions.create({
      model: OPENROUTER_MODEL,
      messages: messages,
      response_format: { type: "json_object" }, 
    });

    const responseText = completion.choices[0].message.content;
    console.log(`OpenRouter response for ${aiUser.display_name}:`, responseText);

    if (!responseText) return [];

    let actions = [];
    try {
        // Handle cases where the model might wrap JSON in markdown blocks
        const cleanedText = responseText.replace(/```json\n?|\n?```/g, "").trim();
        const parsed = JSON.parse(cleanedText);
        //console.log(`Parsed response for ${aiUser.display_name}:`, parsed);
        
        if (Array.isArray(parsed)) {
            actions = parsed;
        } else if (parsed && typeof parsed === 'object') {
            if (parsed.actions && Array.isArray(parsed.actions)) {
                actions = parsed.actions;
            } else {
                // Fallback: look for any array property
                const values = Object.values(parsed);
                const foundArray = values.find(v => Array.isArray(v));
                if (foundArray) {
                    actions = foundArray as any[];
                } else {
                    // Last resort: if the object itself looks like an action, wrap it
                    if (parsed.type === 'message') {
                        actions = [parsed];
                    }
                }
            }
        }

    } catch (e) {
      console.error("Failed to parse OpenRouter response:", responseText, e);
    }

    // Filter only message actions to be safe
    return actions.filter((a: any) => a.type === 'message');

  } catch (error) {
    console.error(`Error processing messages for ${aiUser.display_name}:`, error);
    return [];
  }
}
