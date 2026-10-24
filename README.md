# VIBE — Telegram Mini App (MVP starter)

VIBE is a Telegram Mini App for social discovery, friendship, conversation, and relationships. The client and API include Telegram initData authentication, profile and listing workflows, discovery, likes, chats, blocks, reports, and moderation endpoints. Production readiness still depends on correct configuration, age-assurance integration, and end-to-end testing.

## Stack
- `client/`: React + Vite, Telegram WebApp SDK, responsive mobile UI
- `server/`: Node.js + Express, Telegram `initData` validation, PostgreSQL
- `server/schema.sql`: starter database schema

## Important safety defaults
- Users aged 14–17 and verified adults (18+) are routed into separate server-enforced spaces.
- Adult access requires a verified birth date; self-reported age alone must never unlock adult access.
- Do not enable adult/minor matching.
- Never trust client-supplied Telegram IDs or age; verify Telegram `initData` on the server.
- The codebase has request rate limits and report handling, but production-grade media scanning, an integrated age-assurance provider, audit logs, appeals, and operational abuse review are still release blockers.
- Chat endpoints exist; random chat matching and end-to-end delivery/notification behavior still require validation.

## Server architecture notes

- `server/src/index.js` wires HTTP routes and Telegram webhook behavior.
- `server/src/db.js` owns the shared PostgreSQL pool; `server/src/database-config.js` validates the connection URL, pool size, timeouts, and production TLS verification.
- `server/src/age-policy.js` is the shared age calculation/routing policy.
- `server/src/moderation/` contains focused validators for profile text and report evidence.
- On Render, the process handles `SIGTERM` / `SIGINT` by closing the HTTP listener and PostgreSQL pool gracefully.
- Run `npm test` in `server/` to execute the Node test suite. Keep database credentials in the server environment, never in the client bundle.

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
Implemented in the current codebase (still requires production acceptance testing):
- Telegram identity validation and bot language selection (English, German, Russian)
- Profile read/update and public listing submission with pending-review state
- Discovery with separate teen/adult eligibility filters
- Likes, mutual-match detection, chat list/history/send endpoints
- Block and report endpoints with rate limits and evidence validation
- Admin moderation API and Telegram bot moderation commands
- Responsive React client with a demo fallback outside Telegram

Still needed before public launch:
- integrate and verify an age-assurance provider; a manually set status is not a complete provider integration
- test registration, language, age routing, listing review, likes, chats, blocks, reports, and bans end to end
- production-grade media storage, content scanning, retention limits, and human moderation operations
- audit logging, appeals, account deletion/export, privacy notice, terms, and jurisdiction-specific review
- production smoke tests, dependency monitoring, backups, and alerting

## Age routing and profile review (starter scaffolding)

- Users aged 14–17 are routed to the teen space; users seeking adult access must have a verified birth date of 18 or older. Other or invalid age states remain restricted.
- The server uses verified birth date as authoritative for adult access; self-reported age alone never unlocks adult discovery.
- Keep database schema initialization and migrations reviewed: startup must fail rather than serve requests when schema setup fails.
- Passport/ID images must be handled by a vetted age-assurance provider's hosted flow. This starter intentionally does not accept passport uploads or send identity documents to a general-purpose AI model. Configure a provider adapter and webhook verification before production.
- Automated photo/profile signals create a moderation flag for human review. Do not auto-ban someone because a model guesses their gender from a photo; gender presentation cannot reliably establish identity and such rules can unfairly target transgender people. Ban only after substantiated impersonation/fraud or other policy violations, with an appeal path.
- Apply schema changes to an existing database using a reviewed migration; `CREATE TABLE IF NOT EXISTS` does not add new columns to an existing `users` table. For a fresh database, `schema.sql` includes the new columns.

## Moderation access

- VIBE does not expose an admin panel link in the public website UI. Moderation actions are intended to be operated through authorized Telegram bot commands and server-side admin endpoints.
- Configure `ADMIN_TELEGRAM_IDS` only in the API service environment; never place staff IDs or bot credentials in client-side variables.
- Keep admin access restricted to trusted accounts, review reports before taking action, and add an audit log and appeals workflow before a public launch.
- Do not ban users based only on guesses about gender or appearance. Use reports as review signals and act on substantiated impersonation, fraud, harassment, or policy violations.

For Render, configure secrets in the `vibe-api` service environment and review schema migrations before applying them to an existing database.
