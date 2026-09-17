import type { CapacitorConfig } from "@capacitor/cli";

/**
 * BotMaker Remote Android shell. The web client (web/dist) is bundled into the APK and loaded from the
 * local `https://localhost` WebView origin.
 *
 * The server is plain `http://` on a tailnet address — WireGuard is the transport security, there is no
 * public hostname to hold a certificate for — so `cleartext` and `allowMixedContent` are not a
 * development convenience here, they are the path. `androidScheme: "https"` keeps the bundled app on a
 * secure origin so localStorage and the camera behave.
 */
const config: CapacitorConfig = {
  appId: "dev.liqiye.botmakerremote",
  appName: "BotMaker Remote",
  webDir: "web/dist",
  android: {
    allowMixedContent: true,
  },
  server: {
    androidScheme: "https",
    cleartext: true,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_launcher_foreground",
    },
  },
};

export default config;
