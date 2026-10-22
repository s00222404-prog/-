# VIBE — Telegram Mini App (MVP starter)

VIBE is a social discovery app for friendship and dating, designed to run inside Telegram.

## Stack
- `client/`: React + Vite, Telegram WebApp SDK, responsive mobile UI
- `server/`: Node.js + Express, Telegram `initData` validation, PostgreSQL
- `server/schema.sql`: starter database schema

## Important safety defaults
- Romantic discovery is restricted to adults (18+).
- Do not enable adult/minor matching.
- Never trust client-supplied Telegram IDs or age; verify Telegram `initData` on the server.
- This starter does not include production-ready photo moderation, identity/age verification, rate limiting, or abuse review tooling. Add these before public launch.
- Random chat and direct messaging are not implemented in this first UI scaffold.

## Run locally
Requirements: Node.js 20+ and PostgreSQL.

1. Create a PostgreSQL database and run:
   ```bash
   psql "$DATABASE_URL" -f server/schema.sql
   ```
2. Configure server:
   ```bash
   cd server
   cp .env.example .env
   npm install
   npm run dev
   ```
3. In another terminal:
   ```bash
   cd client
   npm install
   cp .env.example .env
   npm run dev
   ```
4. Open the client URL. Outside Telegram, the app uses demo mode. Real Telegram login requires opening through a bot's Mini App button and configuring `BOT_TOKEN` on the server.

## Telegram setup
- Create a bot with BotFather.
- Set the Mini App URL to your deployed HTTPS client URL.
- Set `BOT_TOKEN` only on the server as an environment secret.
- Set `VITE_API_URL` to the deployed API URL before building the client.

## MVP status
Implemented in this scaffold:
- Telegram identity verification endpoint
- Profile read/create/update endpoint
- Discovery endpoint with age-boundary safety
- Like / mutual match endpoint
- Report and block endpoints (basic)
- Responsive profile/discovery UI with demo mode

Still needed before real users:
- secure session/token strategy after Telegram validation
- comprehensive rate limiting and bot protection
- image upload/storage and moderation
- age assurance appropriate to launch jurisdictions
- messaging implementation, notifications, admin moderation panel, privacy policy, terms, deletion/export workflow, tests and monitoring

## Age routing and profile review (starter scaffolding)

- The self-declared date of birth routes users to `age_gate`, `youth`, or `adult_verification`; it never unlocks adult discovery.
- Adult discovery and likes require `age_verification_status = 'verified'` on the server.
- Passport/ID images must be handled by a vetted age-assurance provider's hosted flow. This starter intentionally does not accept passport uploads or send identity documents to a general-purpose AI model. Configure a provider adapter and webhook verification before production.
- Automated photo/profile signals create a moderation flag for human review. Do not auto-ban someone because a model guesses their gender from a photo; gender presentation cannot reliably establish identity and such rules can unfairly target transgender people. Ban only after substantiated impersonation/fraud or other policy violations, with an appeal path.
- Apply schema changes to an existing database using a reviewed migration; `CREATE TABLE IF NOT EXISTS` does not add new columns to an existing `users` table. For a fresh database, `schema.sql` includes the new columns.

## Admin moderation panel (starter)

- Open the deployed client at `/admin` from the Telegram Mini App context.
- Set `ADMIN_TELEGRAM_IDS` on the API service to a comma-separated list of trusted numeric Telegram user IDs (for example `123456789`). Do not place this value in client-side environment variables or share it publicly.
- The admin API requires valid Telegram `initData` and checks the allowlist server-side on every request. An unlisted account receives HTTP 403.
- The queue displays open reports and moderation flags. Admins can mark an item as under review or resolve/dismiss it, and optionally restrict, suspend, ban, or restore the reported account.
- The current scaffold does not yet provide an audit log, appeals workflow, admin roles, or automated rate limiting. Add these before a public launch; keep the number of admins small and use strong account security.
- Do not make ban decisions based only on AI guesses about a person's gender or appearance. Use reports as review signals and apply actions to substantiated impersonation, fraud, harassment, or policy violations.

For Render, configure `ADMIN_TELEGRAM_IDS` under the `vibe-api` service environment. The Blueprint declares it as a secret/manual value. After updating an existing database, apply the schema/migrations reviewed for your deployed version.
