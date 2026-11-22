import test from "node:test";
import assert from "node:assert/strict";
import {
  loadRelayProfile,
  saveRelayProfile,
  getRelayProfileEndpoints,
  rankRelaysByLatency,
  RELAY_PROFILE_KEY,
  type RelayNodeEntry,
  type StorageLike,
} from "./relay-manager.ts";

function createMemoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

test("loadRelayProfile returns 'public' by default when storage is empty", () => {
  const storage = createMemoryStorage();
  const profile = loadRelayProfile(storage);
  assert.equal(profile, "public");
});

test("loadRelayProfile returns 'public' when storage contains unexpected value", () => {
  const storage = createMemoryStorage({ [RELAY_PROFILE_KEY]: "invalid-profile" });
  const profile = loadRelayProfile(storage);
  assert.equal(profile, "public");
});

test("saveRelayProfile persists 'local-dual' and loadRelayProfile retrieves it", () => {
  const storage = createMemoryStorage();
  saveRelayProfile("local-dual", storage);
  assert.equal(storage.data[RELAY_PROFILE_KEY], "local-dual");
  assert.equal(loadRelayProfile(storage), "local-dual");
});

test("saveRelayProfile and loadRelayProfile handle null storage gracefully", () => {
  assert.doesNotThrow(() => saveRelayProfile("public", null));
  assert.equal(loadRelayProfile(null), "public");
});

test("getRelayProfileEndpoints derives correct endpoints for 'public' profile", () => {
  const endpoints = getRelayProfileEndpoints("public", "http:", "localhost:3000");
  assert.equal(endpoints.profile, "public");
  assert.equal(endpoints.isLocalLab, false);
  assert.equal(endpoints.label, "Public Relays");
  assert.equal(endpoints.badgeText, "Public Croc Relays");
  assert.equal(endpoints.standardBridgeURL, "ws://localhost:3000/ws");
  assert.equal(endpoints.enhancedDualURL, "ws://localhost:3000/ws-dual");
});

test("getRelayProfileEndpoints derives correct endpoints for 'local-dual' profile", () => {
  const endpoints = getRelayProfileEndpoints("local-dual", "https:", "crocflow.campus.edu");
  assert.equal(endpoints.profile, "local-dual");
  assert.equal(endpoints.isLocalLab, true);
  assert.equal(endpoints.label, "Local Lab");
  assert.equal(endpoints.badgeText, "Local Dual-Relay Lab (Offline/LAN)");
  assert.equal(endpoints.standardBridgeURL, "wss://crocflow.campus.edu/ws");
  assert.equal(endpoints.enhancedDualURL, "wss://crocflow.campus.edu/ws-dual");
});

test("getRelayProfileEndpoints handles trailing slashes in host", () => {
  const endpoints = getRelayProfileEndpoints("local-dual", "http:", "192.168.1.50:3000///");
  assert.equal(endpoints.standardBridgeURL, "ws://192.168.1.50:3000/ws");
  assert.equal(endpoints.enhancedDualURL, "ws://192.168.1.50:3000/ws-dual");
});

test("rankRelaysByLatency sorts online nodes by RTT and offline nodes at the end", () => {
  const nodes: RelayNodeEntry[] = [
    {
      id: "node-1",
      name: "Public Relay 1",
      host: "1.getcroc.com",
      port: "9009",
      address: "1.getcroc.com:9009",
      kind: "public",
      rttMs: 120,
      status: "online",
    },
    {
      id: "node-2",
      name: "Public Relay 2",
      host: "2.getcroc.com",
      port: "9009",
      address: "2.getcroc.com:9009",
      kind: "public",
      rttMs: 25,
      status: "online",
    },
    {
      id: "node-3",
      name: "Public Relay 3",
      host: "3.getcroc.com",
      port: "9009",
      address: "3.getcroc.com:9009",
      kind: "public",
      rttMs: null,
      status: "offline",
    },
    {
      id: "node-alpha",
      name: "Local Relay Alpha",
      host: "localhost",
      port: "3000",
      address: "localhost:3000",
      kind: "local-alpha",
      rttMs: 2,
      status: "online",
    },
  ];

  const ranked = rankRelaysByLatency(nodes);
  assert.equal(ranked[0].id, "node-alpha"); // 2ms
  assert.equal(ranked[1].id, "node-2");     // 25ms
  assert.equal(ranked[2].id, "node-1");     // 120ms
  assert.equal(ranked[3].id, "node-3");     // offline
});
