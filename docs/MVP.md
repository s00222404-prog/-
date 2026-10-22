# VIBE MVP scope

## Release 0.1
- Telegram identity validation on the server
- Editable profile fields
- Discover adult profiles
- Likes and mutual-match detection
- Block and report endpoints
- Mobile-first dark UI prototype

## Not yet implemented
- Messaging API and chat UI
- Random chat queue and compatibility ranking
- Photo upload/storage and image moderation
- Enforced age assurance
- Admin moderation dashboard and appeal workflow
- Rate limiting, abuse heuristics, audit logs, integration tests
- Privacy policy, terms, retention/deletion/export process
- Automated deployment and production smoke tests

## Release gates before public launch
1. Age assurance appropriate to applicable law and risk; no adult/minor matching.
2. Server-side authorization and rate limits on every sensitive endpoint.
3. User report review process and emergency escalation policy.
4. Secure image hosting and moderation.
5. Data minimization, account deletion, privacy notice and terms.
6. Security review and end-to-end tests.

## Age routing and identity safety

1. Ask for date of birth at registration and use it only to route: unknown -> age gate; under 18 -> youth experience; claimed 18+ -> adult verification holding area.
2. Adult-only discovery, likes, matches, and messaging remain blocked until the server receives a verified result from an integrated age-assurance provider.
3. Do not store passport scans in VIBE or feed them to a general-purpose AI model. Use a vetted provider's hosted document/age check, validate signed webhooks server-side, retain only the minimum verification result, and define deletion/retention rules with privacy counsel.
4. AI photo/profile signals create an admin review queue, not an instant ban based on guessed gender. Use manual review for suspected impersonation and provide appeals.
5. Ensure every discovery/chat entry point shares the same server-side access policy; the current starter does not yet implement chat delivery or a production provider adapter.
