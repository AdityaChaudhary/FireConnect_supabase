# FireConnect Codebase Knowledge Base

This document serves as a structured technical reference of the FireConnect codebase to assist in the migration from Firebase to Supabase.

## 1. System Architecture
- **Frontend**: Vite + React (TypeScript) + Tailwind CSS + React Query.
- **Backend (Old)**: Firebase (Auth, Cloud Functions, Firestore, Storage).
- **Data Layer (Old)**: Hybrid of Firebase DataConnect (Postgres with GraphQL interface) and native Firestore.
- **Backend (New - Planned)**: Supabase (Auth, Edge Functions in Deno, Postgres/PostgREST, Storage).

---

## 2. Core Data Models (Structured for LLM)

### 2.1 Firebase DataConnect Entities (Relational)
The core schema is defined in `dataconnect/schema/schema.gql`.

| Entity | Fields & Types | Key Details |
| :--- | :--- | :--- |
| **`User`** | `id` (UUID), `username`, `email`, `displayName`, `bio`, `gender`, `location`, `latitude`, `longitude`, `interests`, `userType` (HUMAN/AI), `spyCredits` | Primary user record. `id` matches Auth UID. |
| **`ProfileImage`** | `user` (FK), `url`, `blurredUrl`, `isProfile`, `order`, `visibility` (PUBLIC/PRIVATE/CONNECTIONS) | Support for blurred private images. |
| **`Connection`** | `requester` (FK), `recipient` (FK), `status` (PENDING/CONNECTED/DECLINED) | Symmetric friendship model. |
| **`Story`** | `user` (FK), `mediaUrl`, `createdAt`, `expiresAt` | Ephemeral media. |
| **`Message`** | `sender`, `receiver`, `text`, `mediaUrl` | DataConnect version of messages. |
| **`UserOnlineStatus`**| `user` (FK), `lastSeenAt` | Tracks user presence. |
| **`NotificationCheck`**| `user` (FK), `lastCheckedAt` | Used for tracking unread notifications. |

### 2.2 Firestore Collections (NoSQL)
Historically used for objects requiring heavy real-time performance.

1.  **`threads`**:
    *   `id`: Deterministic (sorted `uid1_uid2`).
    *   `participants`: `string[]`.
    *   `lastMessage`: `string`.
    *   `lastMessageTime`: `Timestamp`.
    *   `unreadCount`: `number`.
    *   `lastRead`: `map<userId, Timestamp>`.
2.  **`threads/{id}/messages`**:
    *   `sender`: `string`.
    *   `text/type/time`.
3.  **`customers`**: Mapping for Stripe Customer IDs to Firebase UIDs (internal to Extension).

---

## 3. Business Logic & Functional Units

### 3.1 AI Orchestrator (`functions/src/aiEngine.ts`)
- **Engine**: Genkit + Gemini 2.5 Flash Lite.
- **Heartbeat**: Scheduled function (every 1m).
- **Operations**:
    1.  Fetches all "AI" type users from DataConnect.
    2.  Updates their online status.
    3.  Scans Firestore `threads` for unread messages where AI is a participant.
    4.  Scans DataConnect for pending incoming `Connection` requests.
    5.  Passes context to Gemini to decide on actions: `message`, `accept_request`, `decline_request`, `disconnect`.
    6.  Executes actions back to Firestore/DataConnect.

### 3.2 User Details & Auth Flow (`context/AuthContext.tsx`)
- **Login**: Google OAuth via `signInWithPopup`.
- **Role Sync**: Currently uses `stripeRole` from Firebase Custom Claims (set by Stripe Extension).
- **Subscription Sync**: Polls for custom claim updates upon role change.
- **Profile**: Fetches `User` record from DataConnect immediately after Auth state change.

### 3.3 Image Handling & Processing
- **Resolver (`lib/image-resolver.ts`)**: Resolves paths to CDN URLs synchronously in PROD.
- **Processing (`scripts/createAIUsers.ts`)**: Uses `sharp` to resize (1920px), compress (JPEG), and generate blurred versions of private photos.

### 3.4 Stripe Integration (`functions/src/spyCreditsWebhook.ts`)
- Processes `customer.subscription.created/updated` and `checkout.session.completed`.
- Maps Stripe customer to user via Firestore `customers` collection or metadata.
- Updates `spyCredits` in DataConnect.

---

## 4. Migration Hotspots (Technical Checklist)

1.  **Deterministic Thread IDs**: Ensure logic `[id1, id2].sort().join('_')` is preserved in Supabase `threads.id` (TEXT PK).
2.  **Deno Conversion**: replace `sharp` with Deno-compatible image processing (e.g. `MagickWasm` or native Deno libs). Replace `genkit` with raw Gemini SDK if needed for Deno stability.
3.  **Real-time Integration**: Replace Firestore `onSnapshot` and Notification polling with Supabase Realtime Channels.
4.  **Stripe Roles**: Store roles in `public.users.stripe_role` and use Postgres triggers to propagate to `auth.users.raw_app_meta_data`.
5.  **RLS Mapping**:
    *   `PRIVATE` images: Check `auth.uid() == owner_id OR auth.jwt() -> 'stripe_role' IN ('pro', 'max')`.
    *   Messages: Restrict to `auth.uid() IN (participants)`.

---

## 5. Development Utilities
- **`hooks/useData.ts`**: Centralized React Query hooks. refactor to use `supabaseClient`.
- **`lib/firebase.ts`**: Hub of Firebase instances. replace with singleton `supabaseClient`.
- **`scripts/createAIUsers.ts`**: Complex script using `firebase-admin`, `genkit`, `sharp`, and `cli-progress`. Requires significant Deno porting.
- **`lib/stripe-utils.ts`**: Uses `@invertase/firestore-stripe-payments`. rewrite to use direct Stripe Checkout / Portal links.
