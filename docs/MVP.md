# VIBE MVP scope

## Release 0.1
- Telegram identity validation on the server
- Editable profile fields
- Discover adult profiles
- Likes and mutual-match detection
- Block and report endpoints
- Mobile-first dark UI prototype

## Still incomplete or requiring production validation
- Random chat queue and compatibility ranking
- Production media storage and robust image/video moderation (uploads currently use data URLs)
- Integrated age-assurance provider and verified webhook flow
- Admin audit log, appeals workflow, and operational moderation process
- End-to-end tests, abuse monitoring, dependency alerts, and production smoke tests
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

1. Ask for date of birth at registration and use it only to route: unknown -> age gate; ages 14–17 -> teen space; claimed 18+ -> adult verification holding area.
2. Adult-only discovery, likes, matches, and messaging remain blocked until the server receives a verified result from an integrated age-assurance provider.
3. Do not store passport scans in VIBE or feed them to a general-purpose AI model. Use a vetted provider's hosted document/age check, validate signed webhooks server-side, retain only the minimum verification result, and define deletion/retention rules with privacy counsel.
4. AI photo/profile signals create an admin review queue, not an instant ban based on guessed gender. Use manual review for suspected impersonation and provide appeals.
5. Ensure every discovery/chat entry point shares the same server-side access policy; chat endpoints exist, but age-assurance provider integration and end-to-end age-boundary testing remain release blockers.
