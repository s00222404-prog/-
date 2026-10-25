# VIBE Android APK

This packages the existing React/Vite VIBE client in a native Android shell using Capacitor. The app uses the same `client/src/main.jsx`, `client/src/style.css`, translations, Supabase email-code login, and VIBE API as the website; it is not a separate demo UI.

## One-time setup

Requirements: Node.js 22 or newer, Android Studio with an Android SDK, and the VIBE repository.

1. Copy `client/.env.example` to `client/.env`.
2. Keep `VITE_API_URL=https://znakomstva-824i.onrender.com`.
3. In Supabase project settings, copy the project's **publishable/anon client key** into `VITE_SUPABASE_PUBLISHABLE_KEY`. Never use the `service_role` key in the client or APK.
4. Open a terminal in `client/` and run:

   ```bash
   npm install
   npm run android:init
   npm run android:sync
   npm run android:open
   ```

5. Android Studio opens the `client/android` project. Wait for Gradle sync to finish.

## Build the APK

In Android Studio select **Build → Build Bundle(s) / APK(s) → Build APK(s)**. The debug APK is usually created at:

`client/android/app/build/outputs/apk/debug/app-debug.apk`

For an APK you can distribute, use **Build → Generate Signed Bundle / APK** and create/keep your own signing key safely.

## Updating VIBE

After changing the website client, run these commands from `client/`:

```bash
npm run android:sync
npm run android:open
```

Then build the APK again. The API and Supabase remain hosted services, so login, profiles, listings, moderation, and chats require internet access and a healthy backend. The UI files themselves are bundled into the app; changing the website does not automatically update an already-built APK.

## Notes

- The app uses the same client source and styles rather than loading the live website in a remote WebView.
- The Android WebView origin is `https://localhost`; the API CORS allowlist must include this origin.
- The Supabase publishable/anon key is intended for client apps; database access must remain protected by Supabase RLS and server-side checks.
- No private API token, bot token, database password, or Supabase `service_role` key belongs in `client/.env`.
