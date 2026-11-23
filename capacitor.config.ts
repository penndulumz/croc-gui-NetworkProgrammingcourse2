import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.crocflow.mobile",
  appName: "CrocFlow",
  webDir: "dist",
  server: {
    // The APK ships only static `dist/`; the user points it at a CrocFlow Bridge
    // Server on the LAN (Relays & Network view), typically plain
    // `http://192.168.x.y:3000` + `ws://.../ws` because LAN machines rarely have
    // TLS certificates.
    //
    // Trade-off: with `androidScheme: "https"` the page origin is
    // `https://localhost`, and the WebView blocks every `http://` / `ws://`
    // request from it as mixed content. The alternative that keeps https,
    // `android.allowMixedContent: true`, switches the WebView to
    // MIXED_CONTENT_ALWAYS_ALLOW for all hosts and all resource types, which is
    // broader. Serving the bundle as `http://localhost` instead removes the
    // mixed-content problem only for our own requests, and `localhost` is still
    // a secure context, so Web Crypto, IndexedDB and service workers keep
    // working. Cost: the origin changes from https://localhost, so data saved
    // under the old origin (localStorage / IndexedDB) is not carried over.
    androidScheme: "http",
    // Android 9+ blocks cleartext HTTP at the OS level unless the app opts in
    // (android:usesCleartextTraffic); the WebView honours it. Needed to reach a
    // LAN Bridge Server over http:// / ws://. A Bridge Server behind https/wss
    // works without it.
    cleartext: true,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
