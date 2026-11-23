import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BRIDGE_ORIGIN_KEY,
  bridgeHttpURL,
  bridgeWsURL,
  clearBridgeOrigin,
  isNativeShell,
  loadSavedBridgeOrigin,
  needsBridgeOrigin,
  normalizeBridgeOrigin,
  resolveBridgeOrigin,
  saveBridgeOrigin,
  shareLinkOrigin,
  type BridgeLocation,
  type BridgeOriginStorage,
} from "./bridge-origin.ts";

class MemoryStorage implements BridgeOriginStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

const servedHttp: BridgeLocation = {
  protocol: "http:",
  host: "localhost:3000",
  origin: "http://localhost:3000",
};
const servedHttps: BridgeLocation = {
  protocol: "https:",
  host: "crocflow.campus.edu",
  origin: "https://crocflow.campus.edu",
};
const capacitorPage: BridgeLocation = {
  protocol: "http:",
  host: "localhost",
  origin: "http://localhost",
};

test("normalizeBridgeOrigin accepts host:port, full URLs and strips paths", () => {
  assert.equal(normalizeBridgeOrigin("192.168.1.10:3000"), "http://192.168.1.10:3000");
  assert.equal(normalizeBridgeOrigin("  http://192.168.1.10:3000/  "), "http://192.168.1.10:3000");
  assert.equal(normalizeBridgeOrigin("https://crocflow.example.com/a/b?c=1"), "https://crocflow.example.com");
  assert.equal(normalizeBridgeOrigin("HTTP://PC.LOCAL:3000"), "http://pc.local:3000");
  assert.equal(normalizeBridgeOrigin("http://[fe80::1]:3000"), "http://[fe80::1]:3000");
});

test("normalizeBridgeOrigin rejects empty, non-http(s) and credentialed input", () => {
  assert.equal(normalizeBridgeOrigin(""), null);
  assert.equal(normalizeBridgeOrigin("   "), null);
  assert.equal(normalizeBridgeOrigin(null), null);
  assert.equal(normalizeBridgeOrigin("ws://192.168.1.10:3000"), null);
  assert.equal(normalizeBridgeOrigin("file:///etc/passwd"), null);
  assert.equal(normalizeBridgeOrigin("javascript://alert(1)"), null);
  assert.equal(normalizeBridgeOrigin("http://user:pw@192.168.1.10:3000"), null);
  assert.equal(normalizeBridgeOrigin("http://"), null);
});

test("save/load/clear round-trips a normalized origin", () => {
  const storage = new MemoryStorage();
  assert.equal(loadSavedBridgeOrigin(storage), null);
  assert.equal(saveBridgeOrigin("192.168.1.10:3000/", storage), "http://192.168.1.10:3000");
  assert.equal(storage.getItem(BRIDGE_ORIGIN_KEY), "http://192.168.1.10:3000");
  assert.equal(loadSavedBridgeOrigin(storage), "http://192.168.1.10:3000");
  assert.equal(saveBridgeOrigin("ftp://nope", storage), null);
  assert.equal(loadSavedBridgeOrigin(storage), "http://192.168.1.10:3000");
  clearBridgeOrigin(storage);
  assert.equal(loadSavedBridgeOrigin(storage), null);
});

test("loadSavedBridgeOrigin ignores a corrupted stored value", () => {
  const storage = new MemoryStorage();
  storage.setItem(BRIDGE_ORIGIN_KEY, "not a url at all ::");
  assert.equal(loadSavedBridgeOrigin(storage), null);
});

test("isNativeShell detects the Capacitor global and native-shell protocols only", () => {
  assert.equal(isNativeShell(undefined), false);
  assert.equal(isNativeShell({ location: servedHttp }), false);
  assert.equal(isNativeShell({ location: servedHttps }), false);
  assert.equal(isNativeShell({ location: capacitorPage }), false);
  assert.equal(
    isNativeShell({ location: capacitorPage, Capacitor: { isNativePlatform: () => true } }),
    true,
  );
  assert.equal(
    isNativeShell({ location: servedHttp, Capacitor: { isNativePlatform: () => false } }),
    false,
  );
  assert.equal(
    isNativeShell({ location: { protocol: "capacitor:", host: "localhost" } }),
    true,
  );
  assert.equal(isNativeShell({ location: { protocol: "file:", host: "" } }), true);
});

test("served by the Bridge Server with nothing saved, URLs resolve exactly as before", () => {
  const storage = new MemoryStorage();
  const env = { storage, location: servedHttp, native: false };
  assert.equal(resolveBridgeOrigin(env), "http://localhost:3000");
  assert.equal(needsBridgeOrigin(env), false);
  // HTTP stays relative (same-origin fetch, unchanged).
  assert.equal(bridgeHttpURL("/healthz", env), "/healthz");
  assert.equal(bridgeHttpURL("api/relays/status", env), "/api/relays/status");
  assert.equal(
    bridgeHttpURL("/api/relays/ping?target=public&index=0", env),
    "/api/relays/ping?target=public&index=0",
  );
  // WebSocket derives from the page location, as deriveBridgeURL(location...) did.
  assert.equal(bridgeWsURL("/ws", env), "ws://localhost:3000/ws");
  assert.equal(bridgeWsURL("/ws-dual", env), "ws://localhost:3000/ws-dual");
  assert.equal(shareLinkOrigin(env), "http://localhost:3000");

  const secure = { storage, location: servedHttps, native: false };
  assert.equal(bridgeWsURL("/ws", secure), "wss://crocflow.campus.edu/ws");
  assert.equal(bridgeWsURL("/ws-dual", secure), "wss://crocflow.campus.edu/ws-dual");
  assert.equal(bridgeHttpURL("/healthz", secure), "/healthz");
});

test("native shell with nothing saved reports a missing origin", () => {
  const env = { storage: new MemoryStorage(), location: capacitorPage, native: true };
  assert.equal(resolveBridgeOrigin(env), null);
  assert.equal(needsBridgeOrigin(env), true);
});

test("a saved origin routes HTTP and WebSocket URLs to the LAN Bridge Server", () => {
  const storage = new MemoryStorage();
  saveBridgeOrigin("http://192.168.1.10:3000", storage);
  const env = { storage, location: capacitorPage, native: true };
  assert.equal(resolveBridgeOrigin(env), "http://192.168.1.10:3000");
  assert.equal(needsBridgeOrigin(env), false);
  assert.equal(bridgeHttpURL("/healthz", env), "http://192.168.1.10:3000/healthz");
  assert.equal(bridgeHttpURL("/api/runtime-config", env), "http://192.168.1.10:3000/api/runtime-config");
  assert.equal(bridgeWsURL("/ws", env), "ws://192.168.1.10:3000/ws");
  assert.equal(bridgeWsURL("/ws-dual", env), "ws://192.168.1.10:3000/ws-dual");
  assert.equal(shareLinkOrigin(env), "http://192.168.1.10:3000");

  saveBridgeOrigin("https://crocflow.example.com", storage);
  assert.equal(bridgeWsURL("/ws", env), "wss://crocflow.example.com/ws");
  assert.equal(bridgeHttpURL("/healthz", env), "https://crocflow.example.com/healthz");
});

test("without a window location the WebSocket fallback matches the old default", () => {
  const env = { storage: null, location: null, native: false };
  assert.equal(bridgeWsURL("/ws-dual", env), "ws://localhost:3000/ws-dual");
  assert.equal(resolveBridgeOrigin(env), null);
});
