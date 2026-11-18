# ROOMIE

ROOMIE is a React + TypeScript flatmate-finder starter with a real Supabase-backed account, profile, discovery, matching, chat, and accommodation-listing flow. The UI never fabricates accounts, people, likes, matches, or messages. Set up a Supabase project to use the cloud-backed features.

## Stack

- React 19, TypeScript, Vite, React Router
- Supabase Auth, Postgres, Row Level Security, Storage, Realtime, and Edge Functions
- Framer Motion, Lucide, React Hook Form, and Zod
- Anthropic Claude is called only by the `ai-search` Edge Function; its key is never a browser variable

## Local setup

1. Install Node.js 22 or newer and the Supabase CLI. Create a Supabase project.
2. Install dependencies and configure browser-safe project credentials:

   ```sh
   npm install
   cp .env.example .env.local
   ```

   Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`. Never use a Supabase service-role key in the browser or a `VITE_` variable.

3. Link the CLI to your Supabase project and apply the database migration:

   ```sh
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

   The migration provisions the schema, constraints, indexes, RLS policies, matching/journey/report functions, a private-by-folder profile upload policy, and Realtime publication for chat and notifications. `supabase/seed.sql` intentionally contains no fake users or sample matches.

4. In Supabase **Authentication → URL Configuration**, set the local site URL to `http://localhost:5173` and add it to the redirect allow list. Enable email/password and email confirmation. For production, add the deployed domain and reset-password redirect URL.

5. Add the AI provider key only to Supabase's Edge Function secrets and deploy:

   ```sh
   supabase secrets set ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY
   supabase functions deploy ai-search
   supabase functions deploy delete-account
   ```

   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are provided to deployed Supabase Edge Functions by the platform. For local Edge Function development, create `supabase/functions/.env` with those three values and `ANTHROPIC_API_KEY`; do not commit that file.

6. Start the app:

   ```sh
   npm run dev
   ```

   Without Supabase credentials the public landing page remains available; account and data features explain that backend setup is required.

## Admin access

Create and verify an account normally, then promote that account using the Supabase SQL editor:

```sql
insert into public.admin_roles (user_id, role)
select id, 'admin' from auth.users where email = 'admin@example.com';
```

Admin RPCs check the role in the database, and each management action is written to `audit_log`. Never make the admin role writable from the client.

## Checks

```sh
npm run build
npm run lint
npm run test:scoring
```

## Deploy the frontend to Vercel

Import the repository into Vercel, use the Vite preset, and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as project environment variables. Deploy the Supabase migration and Edge Function separately as described above. Set Supabase Auth's production site URL and redirect allow list to your Vercel domain. Do not configure `ANTHROPIC_API_KEY` in Vercel's browser build environment.

## Implemented flow and important limits

- [x] Responsive ROOMIE landing page, navigation, safety and policy pages
- [x] Email signup with 18+ confirmation, email/password login, email verification handoff, password reset request, protected app routes
- [x] Profile onboarding/edit, validated profile-photo upload, visibility setting
- [x] Discover real profiles, deterministic 25/20/30/15/10 compatibility breakdown, like/pass/save, server-created mutual matches
- [x] Match list, participant-only Realtime chat, owner-managed accommodation listings
- [x] Claude-backed natural-language filter extraction with server-side auth, rate limit, strict Zod validation, and no profile-data access
- [x] Match journey chat-confirmation and meeting RPCs, server-side reports/blocks, and admin moderation primitives
- [x] User-confirmed account deletion through an authenticated Edge Function, including profile-photo cleanup
- [x] Scoring unit tests
- [ ] Full multi-step profile fields, multiple photo management, saved filter UI, advanced server-side filtering/pagination, broader admin content management, and end-to-end tests with two real Supabase accounts
- [ ] End-to-end tests with two real Supabase accounts and a configured admin account

The checklist reflects what can be exercised in this workspace without Supabase project credentials or real test accounts. The initial migration contains server-side policies/functions for sensitive operations; production rollout still needs live Supabase integration testing, policy review, legal policy review, email-provider configuration, and monitoring.
