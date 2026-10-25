import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vibe.app',
  appName: 'VIBE',
  webDir: 'dist',
  server: {
    // Keep the UI bundled in the APK. Do not set server.url to the website:
    // this makes the app launch the same built React UI offline-first.
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
