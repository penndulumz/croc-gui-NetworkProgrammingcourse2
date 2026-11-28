# 0005: Native Android Direct Transport to Public Croc Relays

Status: accepted

The Capacitor APK previously used the Bridge Server to convert WebSocket frames into TCP connections to Croc relays. This prevented Android users from transferring files without deploying or reaching a Bridge Server. We decided to add a native Android TCP transport for the `public` Relay Profile. It connects directly to the official public Croc relay hosts and preserves the existing Croc framing and transfer protocols.

The native transport is generated into the Capacitor Android project by `scripts/prepare-android-native.mjs`; the generated `android/` project remains uncommitted. The Java bridge restricts destinations to `1.getcroc.com` through `4.getcroc.com` and TCP ports `9009–9017`. The Web/PWA and Electron Desktop transports remain unchanged and continue to use the Bridge Server. The Android APK uses the built-in public relay list and no longer requires a runtime Bridge Server configuration for public transfers.

## Considered Options

- **Keep requiring a public Bridge Server for Android**: Rejected because it requires an independently hosted service and blocks direct Android use without one.
- **Replace the shared transport with native TCP on every platform**: Rejected because browsers cannot open raw TCP sockets and Desktop already bundles its Bridge Server.
- **Allow arbitrary native TCP destinations**: Rejected because a compromised WebView could use the native interface to probe local networks or arbitrary hosts.

## Consequences

- Android Public Croc transfers can connect to another CrocFlow Android/Desktop client or the official `croc` CLI through public Croc relays without a CrocFlow Bridge Server.
- The direct APK path still requires Internet access and outbound TCP connectivity to ports `9009–9017`; networks that block those ports can prevent transfers.
- Local Dual-Relay Lab and custom relays continue to require a Bridge Server and are not available through Android direct mode.
- Web/PWA, Desktop, relay allowlisting, and the existing `server.ts` Bridge Server behavior remain unchanged.
