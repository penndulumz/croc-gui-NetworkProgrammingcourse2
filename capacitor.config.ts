import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.crocflow.mobile",
  appName: "CrocFlow",
  webDir: "dist",
  server: {
    // Keep localhost on a secure context for Web Crypto, IndexedDB and service
    // workers. The current Android APK uses its native TCP transport for public
    // Croc relays; http://localhost also retains compatibility with older APKs
    // and optional LAN Bridge Server connections.
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
    // Retain cleartext compatibility for optional LAN Bridge Server connections
    // and older APK builds. Direct TCP relay sockets do not use HTTP or WebSocket.
    cleartext: true,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
