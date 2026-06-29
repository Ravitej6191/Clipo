import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.clipo.app',
  appName: 'Clipo',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
