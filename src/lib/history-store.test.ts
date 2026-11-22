import test from "node:test";
import assert from "node:assert/strict";
import {
  loadPeerPresets,
  savePeerPreset,
  deletePeerPreset,
  touchPeerPreset,
  loadDeviceAlias,
  saveDeviceAlias,
  loadTransferHistory,
  appendTransferHistory,
  clearTransferHistory,
  type PeerPreset,
} from "./history-store.ts";

function createMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
}

test("loadPeerPresets returns empty array on empty storage or missing key", () => {
  const storage = createMockStorage();
  const presets = loadPeerPresets(storage);
  assert.deepEqual(presets, []);
});

test("loadPeerPresets handles corrupted JSON gracefully", () => {
  const storage = createMockStorage();
  storage.setItem("crocflow-peer-presets-v1", "{corrupted json invalid");
  const presets = loadPeerPresets(storage);
  assert.deepEqual(presets, []);
});

test("loadPeerPresets handles non-array JSON gracefully", () => {
  const storage = createMockStorage();
  storage.setItem("crocflow-peer-presets-v1", JSON.stringify({ key: "not an array" }));
  const presets = loadPeerPresets(storage);
  assert.deepEqual(presets, []);
});

test("loadPeerPresets filters malformed objects and sorts by lastSeen descending", () => {
  const storage = createMockStorage();
  const rawList = [
    { id: "p1", alias: "Laptop Lab", lastSeen: 1000, preferredRelayProfile: "local-dual" },
    { notAValidPreset: true },
    null,
    "string-entry",
    { id: "", alias: "No ID" },
    { id: "p2", alias: "Phone", lastSeen: 2000, preferredRelayProfile: "public", notes: "My phone" },
    { id: "p3", alias: "Tablet", lastSeen: 1500, preferredRelayProfile: "invalid-profile" },
  ];
  storage.setItem("crocflow-peer-presets-v1", JSON.stringify(rawList));

  const loaded = loadPeerPresets(storage);
  assert.equal(loaded.length, 3);
  // Sorted by lastSeen descending
  assert.equal(loaded[0].id, "p2");
  assert.equal(loaded[0].preferredRelayProfile, "public");
  assert.equal(loaded[0].notes, "My phone");

  assert.equal(loaded[1].id, "p3");
  assert.equal(loaded[1].preferredRelayProfile, undefined); // Invalid profile sanitized to undefined

  assert.equal(loaded[2].id, "p1");
  assert.equal(loaded[2].preferredRelayProfile, "local-dual");
});

test("savePeerPreset creates a new preset with auto-generated id and persists to storage", () => {
  const storage = createMockStorage();
  const saved = savePeerPreset(
    {
      alias: "  Workstation RTX  ",
      preferredRelayProfile: "local-dual",
      notes: "Lab machine #1",
    },
    storage,
  );

  assert.ok(saved.id.startsWith("peer-"));
  assert.equal(saved.alias, "Workstation RTX");
  assert.equal(saved.preferredRelayProfile, "local-dual");
  assert.equal(saved.notes, "Lab machine #1");
  assert.ok(saved.lastSeen > 0);

  const reloaded = loadPeerPresets(storage);
  assert.equal(reloaded.length, 1);
  assert.equal(reloaded[0].id, saved.id);
  assert.equal(reloaded[0].alias, "Workstation RTX");
});

test("savePeerPreset supports 'local-lab' as canonical relay profile", () => {
  const storage = createMockStorage();
  const saved = savePeerPreset(
    {
      alias: "Campus Cluster",
      preferredRelayProfile: "local-lab",
      notes: "Local LAN node",
    },
    storage,
  );
  assert.equal(saved.preferredRelayProfile, "local-lab");
  const loaded = loadPeerPresets(storage);
  assert.equal(loaded[0].preferredRelayProfile, "local-lab");
});

test("savePeerPreset trims and truncates alias to 48 characters", () => {
  const storage = createMockStorage();
  const longName = "A".repeat(60);
  const saved = savePeerPreset({ alias: longName }, storage);
  assert.equal(saved.alias.length, 48);
  assert.equal(saved.alias, "A".repeat(48));
});

test("savePeerPreset handles duplicate alias by updating existing preset without duplicating", () => {
  const storage = createMockStorage();
  const first = savePeerPreset(
    { alias: "Minh Phone", preferredRelayProfile: "public", notes: "Initial note" },
    storage,
  );
  assert.equal(loadPeerPresets(storage).length, 1);

  // Save with matching alias (different case and spacing) without id
  const updated = savePeerPreset(
    { alias: "  minh phone  ", preferredRelayProfile: "local-dual", notes: "Updated note" },
    storage,
  );

  const all = loadPeerPresets(storage);
  assert.equal(all.length, 1, "Should not create duplicate entry");
  assert.equal(all[0].id, first.id);
  assert.equal(updated.id, first.id);
  assert.equal(all[0].alias, "minh phone");
  assert.equal(all[0].preferredRelayProfile, "local-dual");
  assert.equal(all[0].notes, "Updated note");
});

test("savePeerPreset updates existing preset when id is provided", () => {
  const storage = createMockStorage();
  const original = savePeerPreset({ alias: "Raspberry Pi 4" }, storage);

  const modified = savePeerPreset(
    {
      id: original.id,
      alias: "Raspberry Pi 4 Cluster Node",
      preferredRelayProfile: "local-dual",
      notes: "Server node",
    },
    storage,
  );

  assert.equal(modified.id, original.id);
  assert.equal(modified.alias, "Raspberry Pi 4 Cluster Node");
  assert.equal(modified.preferredRelayProfile, "local-dual");
  assert.equal(modified.notes, "Server node");

  const list = loadPeerPresets(storage);
  assert.equal(list.length, 1);
  assert.equal(list[0].alias, "Raspberry Pi 4 Cluster Node");
});

test("deletePeerPreset deletes preset by id and returns true, returns false if not found", () => {
  const storage = createMockStorage();
  const p1 = savePeerPreset({ alias: "Device 1" }, storage);
  const p2 = savePeerPreset({ alias: "Device 2" }, storage);
  assert.equal(loadPeerPresets(storage).length, 2);

  const deleted = deletePeerPreset(p1.id, storage);
  assert.equal(deleted, true);

  const remaining = loadPeerPresets(storage);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, p2.id);

  // Deleting non-existent returns false
  const deleteNonExistent = deletePeerPreset("unknown-id", storage);
  assert.equal(deleteNonExistent, false);
});

test("touchPeerPreset updates lastSeen by id or case-insensitive alias", async () => {
  const storage = createMockStorage();
  const p1 = savePeerPreset({ alias: "Alpha Node" }, storage);
  const p2 = savePeerPreset({ alias: "Beta Node" }, storage);

  const initialP1LastSeen = p1.lastSeen;

  // Wait a small amount to ensure timestamp changes
  await new Promise((r) => setTimeout(r, 15));

  touchPeerPreset(p1.id, storage);
  let list = loadPeerPresets(storage);
  const updatedP1 = list.find((p) => p.id === p1.id);
  assert.ok(updatedP1);
  assert.ok(updatedP1.lastSeen > initialP1LastSeen);
  // p1 was touched, so it becomes top of the sorted list
  assert.equal(list[0].id, p1.id);

  // Wait again and touch p2 by alias
  await new Promise((r) => setTimeout(r, 15));
  touchPeerPreset("  beta node  ", storage);
  list = loadPeerPresets(storage);
  const updatedP2 = list.find((p) => p.id === p2.id);
  assert.ok(updatedP2);
  assert.equal(list[0].id, p2.id);

  // Touching unknown does not throw
  touchPeerPreset("non-existent-device", storage);
  touchPeerPreset("", storage);
});

test("loadDeviceAlias and saveDeviceAlias work with storage", () => {
  const storage = createMockStorage();
  const defaultAlias = loadDeviceAlias(storage);
  assert.ok(defaultAlias.length > 0);

  const saved = saveDeviceAlias("Lab MacBook Pro", storage);
  assert.equal(saved, "Lab MacBook Pro");
  assert.equal(loadDeviceAlias(storage), "Lab MacBook Pro");
});

test("transfer history serialization and clearTransferHistory", () => {
  const storage = createMockStorage();
  assert.deepEqual(loadTransferHistory(storage), []);

  const updated = appendTransferHistory(
    {
      direction: "send",
      mode: "enhanced",
      dualRelay: true,
      codephrase: "test-code",
      fileCount: 2,
      summaryName: "docs (+1 tệp)",
      totalBytes: 2048,
      status: "completed",
      verifiedHash: "SHA-256",
      deviceAlias: "Sender Device",
    },
    storage,
  );

  assert.equal(updated.length, 1);
  assert.equal(updated[0].codephrase, "test-code");
  assert.equal(loadTransferHistory(storage).length, 1);

  clearTransferHistory(storage);
  assert.deepEqual(loadTransferHistory(storage), []);
});
