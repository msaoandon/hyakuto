import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.msaoandon.hyakuto',
  appName: 'Hyakuto',
  webDir: 'out',
  plugins: {
    // Held until the web HydrationGate clears (it calls SplashScreen.hide()),
    // so the native splash hands off seamlessly with no unhydrated flash.
    SplashScreen: {
      launchAutoHide: false,
    },
  },
};

export default config;
