import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ai.homesync.app',
  appName: 'HomeSync AI',
  webDir: 'mobile-www',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 700,
      backgroundColor: '#08110f',
      showSpinner: false
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#08110f'
    },
    Keyboard: {
      resize: 'body'
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
