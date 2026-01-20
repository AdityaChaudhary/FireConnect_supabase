---
description: How to deploy the FireConnect app to Supabase and Vercel production
---

# 🚀 Production Deployment Workflow

Follow these steps to deploy the entire application (Database, Functions, Cron
Jobs, and Frontend) to production.

## 1. Supabase Project Setup

1. Create a new project on [Supabase Dashboard](https://database.new).
2. Get your **Project Ref**, **API URL**, **Anon Key**, and **Service Role
   Key**.
3. Go to **Project Settings -> Database** and copy the **Connection String
   (Transaction Pooler - Port 5432)**.

## 2. Local Environment Configuration

Update your `.env` with the production database URL:

```text
PROD_SUPABASE_DB_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
```

## 3. Database Deployment

Run the following commands in order to setup the schema and infrastructure:

### A. Deploy All Migrations

Use the Supabase CLI to push all local migrations to production: // turbo

```bash
supabase link --project-ref [YOUR-PROJECT-REF]
supabase db push
```

### B. Push Vault Secrets

Use the custom script to push AI Engine secrets to the Production Vault: //
turbo

```bash
npm run vault:prod [PROD_PROJECT_URL] [PROD_ANON_KEY]
```

### C. Verify / Manually Apply Specific Migrations (Optional)

If you need to re-apply the AI Engine Cron job or any specific file:

```bash
npm run migrate:prod supabase/migrations/20260120000000_setup_ai_engine_cron.sql
```

## 4. Edge Functions Deployment

Deploy all edge functions to production: // turbo

```bash
supabase functions deploy --project-ref [YOUR-PROJECT-REF]
```

## 5. Frontend Deployment (Vercel)

### Option A: Vercel Dashboard (Recommended)

1. Push your code to a Git repository (GitHub/GitLab/Bitbucket).
2. Go to the [Vercel Dashboard](https://vercel.com/new).
3. Import your repository.
4. **Build Settings**: Vercel should auto-detect Vite. Ensure:
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. **Environment Variables**: Add the variables from your `.env.example`:
   - `VITE_SUPABASE_URL`: Your Production Supabase API URL.
   - `VITE_SUPABASE_ANON_KEY`: Your Production Supabase Anon Key.
   - `GOOGLE_CLIENT_ID`: (If used)
   - `GEMINI_API_KEY`: Your Gemini API Key.
6. Click **Deploy**.

### Option B: Vercel CLI

If you have the [Vercel CLI](https://vercel.com/download) installed: // turbo

```bash
npx vercel --prod
```

_Note: The CLI will prompt you to link the project and add environment variables
if they haven't been set up yet._

### ⚡ SPA Routing

I have already added a
[vercel.json](file:///Users/aditya/Work/Dev/FireConnect_supabase/vercel.json) to
your project. This ensures that when you refresh the page or share a link like
`/profile`, Vercel doesn't return a 404 error but correctly routes back to the
app.

## 6. Post-Deployment Verification

1. Check the **Database -> Cron** tab in Supabase to ensure
   `ai-engine-heartbeat` is running.
2. Check **Edge Functions -> Logs** to ensure matches are being processed.
3. Test a login and chat flow on the production URL.
