import test from "node:test";
import assert from "node:assert/strict";
import {
  findFastestRelay,
  loadRelayProfile,
  saveRelayProfile,
  getRelayProfileEndpoints,
  isLocalLabProfile,
  rankRelaysByLatency,
  resolveStreamPairRtts,
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

test("saveRelayProfile persists 'local-lab' and loadRelayProfile retrieves it", () => {
  const storage = createMemoryStorage();
  saveRelayProfile("local-lab", storage);
  assert.equal(storage.data[RELAY_PROFILE_KEY], "local-lab");
  assert.equal(loadRelayProfile(storage), "local-lab");
});

test("isLocalLabProfile recognizes both 'local-lab' and 'local-dual'", () => {
  assert.equal(isLocalLabProfile("local-lab"), true);
  assert.equal(isLocalLabProfile("local-dual"), true);
  assert.equal(isLocalLabProfile("public"), false);
  assert.equal(isLocalLabProfile(undefined), false);
  assert.equal(isLocalLabProfile(null), false);
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

test("getRelayProfileEndpoints derives correct endpoints for 'local-lab' profile", () => {
  const endpoints = getRelayProfileEndpoints("local-lab", "https:", "crocflow.campus.edu");
  assert.equal(endpoints.profile, "local-lab");
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

test("findFastestRelay identifies lowest latency relay by address, host, or index", () => {
  const addresses = [
    "1.getcroc.com:9009",
    "2.getcroc.com:9009",
    "3.getcroc.com:9009",
    "4.getcroc.com:9009",
  ];

  // Address keyed
  const latenciesAddr: Record<string, number | null> = {
    "1.getcroc.com:9009": 140,
    "2.getcroc.com:9009": 25,
    "3.getcroc.com:9009": 85,
    "4.getcroc.com:9009": null,
  };
  const fastest1 = findFastestRelay(latenciesAddr, addresses);
  assert.notEqual(fastest1, null);
  assert.equal(fastest1?.index, 1);
  assert.equal(fastest1?.host, "2.getcroc.com");
  assert.equal(fastest1?.rttMs, 25);

  // Host keyed
  const latenciesHost: Record<string, number | null> = {
    "1.getcroc.com": 15,
    "2.getcroc.com": 45,
  };
  const fastest2 = findFastestRelay(latenciesHost, addresses);
  assert.notEqual(fastest2, null);
  assert.equal(fastest2?.index, 0);
  assert.equal(fastest2?.host, "1.getcroc.com");
  assert.equal(fastest2?.rttMs, 15);

  // Index keyed
  const latenciesIdx: Record<string, number | null> = {
    "2": 10,
    "3": 50,
  };
  const fastest3 = findFastestRelay(latenciesIdx, addresses);
  assert.notEqual(fastest3, null);
  assert.equal(fastest3?.index, 2);
  assert.equal(fastest3?.host, "3.getcroc.com");
  assert.equal(fastest3?.rttMs, 10);

  // Returns null when no valid latencies or empty addresses
  assert.equal(findFastestRelay({}, addresses), null);
  assert.equal(findFastestRelay({ "1.getcroc.com": null }, addresses), null);
  assert.equal(findFastestRelay(latenciesAddr, []), null);
});

test("resolveStreamPairRtts returns real measured latencies without fabricated offsets", () => {
  const addresses = [
    "1.getcroc.com:9009",
    "2.getcroc.com:9009",
    "3.getcroc.com:9009",
    "4.getcroc.com:9009",
  ];
  const publicRtts = resolveStreamPairRtts({
    relayProfile: "public",
    latencies: { "1.getcroc.com:9009": 42, "3.getcroc.com:9009": 95 },
    relayAddresses: addresses,
    alphaIndex: 0,
    betaIndex: 2,
  });
  assert.deepEqual(publicRtts, { alphaRttMs: 42, betaRttMs: 95 });

  const missingBeta = resolveStreamPairRtts({
    relayProfile: "public",
    latencies: { "1.getcroc.com": 33 },
    relayAddresses: addresses,
    alphaIndex: 0,
    betaIndex: 1,
  });
  assert.deepEqual(missingBeta, { alphaRttMs: 33, betaRttMs: null });

  const localRtts = resolveStreamPairRtts({
    relayProfile: "local-lab",
    latencies: { "local-alpha": 1.2, "local-beta": 1.5 },
  });
  assert.deepEqual(localRtts, { alphaRttMs: 1.2, betaRttMs: 1.5 });
});
