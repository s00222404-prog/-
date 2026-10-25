import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vibe.app',
  appName: 'VIBE',
  webDir: 'dist',
  server: {
    // Keep the UI bundled in the APK. Do not set server.url to the website:
    // this keeps the same built React UI inside the APK; API features need internet.
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
