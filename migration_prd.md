# Migration PRD: Firebase to Supabase

## 1. Goal Description
The objective is to migrate the entire application backend from Firebase to Supabase. This includes migrating Authentication, Database (Firestore/DataConnect), Storage, and Cloud Functions. A key requirement is to standardize on Deno for the backend (Edge Functions) and the Vite app's backend environment.

## 2. Infrastructure Mapping
| Feature | Firebase Service | Supabase Replacement |
| :--- | :--- | :--- |
| **Authentication** | Firebase Auth (Google) | Supabase Auth (Google OAuth) |
| **Database** | Firestore / Data Connect | PostgreSQL (Supabase DB) |
| **Storage** | Firebase Storage | Supabase Storage |
| **Functions** | Cloud Functions (Node.js) | Supabase Edge Functions (Deno) |
| **Real-time** | Firestore Snapshots | Supabase Realtime |

## 3. Proposed Changes

### [Component] Database Schema (PostgreSQL)
We will migrate the NoSQL Firestore structure to a relational PostgreSQL schema with RLS enabled.

#### Tables:
1.  **`users`**:
    *   `id`: UUID (Primary Key, matches Auth ID)
    *   `username`: Text (Unique)
    *   `display_name`: Text
    *   `email`: Text
    *   `profile_picture_url`: Text
    *   `location`: Text
    *   `stripe_role`: Text (FREE, PRO, MAX)
    *   `spy_credits`: Int
    *   `created_at`: Timestamptz
2.  **`profile_images`**:
    *   `id`: UUID (PK)
    *   `user_id`: UUID (FK to users)
    *   `url`: Text
    *   `blurred_url`: Text
    *   `visibility`: Text (PUBLIC, PRIVATE)
    *   `is_profile`: Boolean
3.  **`threads`**:
    *   `id`: Text (PK, deterministic hash of sorted user IDs)
    *   `participants`: UUID[]
    *   `last_message`: Text
    *   `last_message_time`: Timestamptz
    *   `unread_count`: Int
4.  **`messages`**:
    *   `id`: UUID (PK)
    *   `thread_id`: Text (FK to threads)
    *   `sender_id`: UUID (FK to users)
    *   `text`: Text
    *   `type`: Text (e.g., 'text', 'image')
    *   `created_at`: Timestamptz

### [Component] Edge Functions (Deno)
All Cloud Functions will be rewritten in Deno.
-   **`ai-engine`**: Ported from `functions/src/aiEngine.ts`. Will use `@google/generative-ai` (Deno compatible via `npm:`).
-   **`user-details`**: Ported from `functions/src/userDetails.ts`.
-   **`stripe-webhook`**: custom implementation to replace the "Firestore Stripe Payments" extension. It will update `public.users.stripe_role` directly.

### [Component] Storage & RLS
-   **Buckets**: `avatars` (Public), `shared` (Protected).
-   **RLS Policy (Private Images)**: 
    ```sql
    CREATE POLICY "Pro users can view private photos" ON storage.objects
    FOR SELECT USING (
      bucket_id = 'shared' AND 
      (auth.uid() = (storage.foldername(name))[1]::uuid OR 
       (SELECT stripe_role FROM public.users WHERE id = auth.uid()) IN ('pro', 'max'))
    );
    ```

### [Component] Vite App (Deno Backend)
The Vite application will be configured to run in a Deno environment.
- Use `deno task` for development scripts.
- Use `npm:vite` for building.
- Configure `vite.config.ts` for Deno compatibility.

---

## 4. Detailed Todo List

### Section 1: Bootstraping
1.  **Initialize Supabase**: `supabase init`.
2.  **Environment Setup**: Install Supabase CLI and Deno.
3.  **Deno Init**: Create a `deno.json` for the project root to manage dependencies and tasks.
4.  **Vite Config**: Update `vite.config.ts` to ensure compatibility with Deno.
5.  **Client Setup**: Create `lib/supabase.ts` and initialize the Supabase client.

### Section 2: Database & Migrations
1.  **Create Migration**: `supabase migration new init_schema`.
2.  **Define Schema**: Write DDL for `users`, `profile_images`, `threads`, `messages`, etc.
3.  **Triggers**: Create a trigger to update `auth.users.raw_app_meta_data` when `public.users.stripe_role` changes.
4.  **Apply Migration**: `supabase db reset` (locally).
5.  **Data Export**: Create a script to export Firestore collections and DataConnect rows to JSON.
6.  **Data Import**: Create a Deno script to transform JSON and insert into Postgres.
7.  **RLS Policies**: Define Security policies for all tables.

### Section 3: Authentication
1.  **Supabase Auth Config**: Enable Google Provider in Supabase Dashboard.
2.  **Refactor AuthContext**: Replace `firebase/auth` with `@supabase/supabase-js`.
3.  **Stripe Sync**: Remove custom claim polling; use Realtime listener on `public.users` table for role updates.

### Section 4: Storage
1.  **Create Buckets**: Create `avatars` and `shared` buckets.
2.  **Update Config**: Update `lib/image-resolver.ts` to use Supabase Storage URLs.
3.  **Migration Script**: Move existing assets to Supabase buckets.

### Section 5: Edge Functions (Deno)
1.  **Init Functions**: `supabase functions new ai-engine`, etc.
2.  **Add Stripe Webhook**: Implement manual Stripe event handling for `checkout.session.completed` and `customer.subscription.*`.
3.  **Port Code**: Rewrite AI Orchestrator to Deno; replace `genkit` if necessary for Deno stability.
4.  **Secrets Management**: `supabase secrets set GEMINI_API_KEY STRIPE_SECRET_KEY`.

### Section 6: Frontend Refactoring
1.  **Update API Layer**: Rewrite `lib/firestore.ts` and `hooks/useData.ts` to use Supabase queries.
2.  **Real-time Updates**: Replace `onSnapshot` and `onCurrentUserSubscriptionUpdate` with Supabase Realtime Channels.
3.  **Image Processing**: Port `createAIUsers.ts` to Deno; use a Deno-compatible image library for resizing and blurring.

---

## 5. Verification Plan

### Step-by-Step Testing
1.  **Auth Verification**: Test Google Login and role propagation.
2.  **Database Verification**: Verify RLS for threads and messages.
3.  **Messaging Verification**: Test real-time message delivery via Supabase Channels.
4.  **Stripe Verification**: Simulate webhooks and verify `stripe_role` and `spy_credits` update in real-time on UI.
5.  **Storage Verification**: Test private photo access with and without Pro/Max role.

### Automated Tests
-   `supabase test db`: For testing RLS and Schema.
-   `deno test`: For testing Edge Function logic.
