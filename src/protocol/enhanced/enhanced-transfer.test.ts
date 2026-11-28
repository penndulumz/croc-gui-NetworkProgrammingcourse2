import test from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import { createCrocFlowServer } from "../../../server";
import { LocalDualRelayNode } from "../../../server/local-dual-relay";
import {
  receiveEnhancedTransfer,
  resolvePublicDualRelayPlan,
  sendEnhancedTransfer,
  type ChunkCacheAdapter,
  type WebSocketLike,
} from "./enhanced-client";
import { encodeFrame, FrameDecoder } from "../croc/framing";
import type { CrocSocket } from "../croc/transport";
import { makeChunkCacheKey, type ManifestInputFile } from "./manifest";

function createMemoryCache(): {
  adapter: ChunkCacheAdapter;
  store: Map<string, Uint8Array>;
} {
  const store = new Map<string, Uint8Array>();
  return {
    store,
    adapter: {
      loadMap: async () => new Map(store),
      save: async (params) => {
        const key = makeChunkCacheKey(params.filePath, params.chunkIndexInFile, params.sha256);
        store.set(key, new Uint8Array(params.data));
      },
    },
  };
}

function makeTestFiles(includeNewFile: boolean): ManifestInputFile[] {
  const fill = (seed: number, len: number) => {
    const buf = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) buf[i] = (i * 19 + seed * 7) & 0xff;
    return buf;
  };
  const list: ManifestInputFile[] = [
    {
      relativePath: "project/doc1.bin",
      name: "doc1.bin",
      size: 64 * 1024,
      bytes: fill(1, 64 * 1024),
    },
    {
      relativePath: "project/sub/doc2.bin",
      name: "doc2.bin",
      size: 48 * 1024,
      bytes: fill(2, 48 * 1024),
    },
  ];
  if (includeNewFile) {
    list.push({
      relativePath: "project/new-added.bin",
      name: "new-added.bin",
      size: 32 * 1024,
      bytes: fill(3, 32 * 1024),
    });
  }
  return list;
}

const nodeWsFactory = (url: string): WebSocketLike =>
  new WebSocket(url) as unknown as WebSocketLike;

test("Enhanced Dual-Relay transfer encrypts E2E, splits even/odd chunks, and survives live Alpha failover", async () => {
  const server = await createCrocFlowServer({ useViteDev: false, port: 0, host: "127.0.0.1" });
  assert.ok(server.dualRelayNode instanceof LocalDualRelayNode);
  const { port } = await server.listen(0, "127.0.0.1");
  const baseWsUrl = `ws://127.0.0.1:${port}/ws-dual`;

  try {
    const files = makeTestFiles(false); // 112 KB / 16 KB = 7 chunks (0..6)
    const { adapter } = createMemoryCache();
    let failoverFired = false;
    let handleRef: { simulateAlphaDisconnect: () => void } | null = null;

    const sendPromise = sendEnhancedTransfer({
      files,
      codephrase: "crocflow-failover-test-99",
      dualRelay: true,
      chunkSize: 16 * 1024,
      chunkDelayMs: 15,
      baseWsUrl,
      wsFactory: nodeWsFactory,
      emitInspector: false,
      onHandleReady: (h) => {
        handleRef = h;
      },
      onProgress: (p) => {
        if (!failoverFired && p.completedChunks >= 2) {
          failoverFired = true;
          handleRef?.simulateAlphaDisconnect();
        }
      },
    });

    await new Promise((r) => setTimeout(r, 40));

    const recvPromise = receiveEnhancedTransfer({
      codephrase: "crocflow-failover-test-99",
      dualRelay: true,
      baseWsUrl,
      wsFactory: nodeWsFactory,
      cache: adapter,
      emitInspector: false,
    });

    const [sendRes, recvRes] = await Promise.all([sendPromise, recvPromise]);

    assert.equal(failoverFired, true);
    assert.ok(sendRes.failoverRerouted > 0, "Expected at least one even chunk rerouted to Beta");
    assert.equal(recvRes.files.length, 2);
    assert.deepEqual(recvRes.files[0].bytes, files[0].bytes);
    assert.deepEqual(recvRes.files[1].bytes, files[1].bytes);
  } finally {
    await server.close();
  }
});

test("Enhanced Folder Manifest Resume skips cached chunks after disconnect and transfers newly added files", async () => {
  const server = await createCrocFlowServer({ useViteDev: false, port: 0, host: "127.0.0.1" });
  assert.ok(server.dualRelayNode instanceof LocalDualRelayNode);
  const { port } = await server.listen(0, "127.0.0.1");
  const baseWsUrl = `ws://127.0.0.1:${port}/ws-dual`;

  try {
    const { adapter, store } = createMemoryCache();
    const stage1Files = makeTestFiles(false);

    // Stage 1: interrupt after 3 verified chunks saved in Resume Cache
    const abortStage1 = new AbortController();
    const s1Send = sendEnhancedTransfer({
      files: stage1Files,
      codephrase: "crocflow-resume-stage-1",
      dualRelay: true,
      chunkSize: 16 * 1024,
      chunkDelayMs: 10,
      baseWsUrl,
      wsFactory: nodeWsFactory,
      emitInspector: false,
      signal: abortStage1.signal,
    }).catch(() => null);

    await new Promise((r) => setTimeout(r, 40));

    await assert.rejects(
      () =>
        receiveEnhancedTransfer({
          codephrase: "crocflow-resume-stage-1",
          dualRelay: true,
          baseWsUrl,
          wsFactory: nodeWsFactory,
          cache: adapter,
          emitInspector: false,
          stopAfterChunks: 3,
        }),
      /Mô phỏng mất kết nối mạng/,
    );
    abortStage1.abort();
    await s1Send;

    assert.equal(store.size, 3, "Stage 1 should persist exactly 3 verified chunks");

    // Stage 2: add a brand-new file, reconnect, skip the 3 cached chunks
    const stage2Files = makeTestFiles(true);
    const s2Send = sendEnhancedTransfer({
      files: stage2Files,
      codephrase: "crocflow-resume-stage-2",
      dualRelay: true,
      chunkSize: 16 * 1024,
      baseWsUrl,
      wsFactory: nodeWsFactory,
      emitInspector: false,
    });

    await new Promise((r) => setTimeout(r, 40));

    const s2Recv = receiveEnhancedTransfer({
      codephrase: "crocflow-resume-stage-2",
      dualRelay: true,
      baseWsUrl,
      wsFactory: nodeWsFactory,
      cache: adapter,
      emitInspector: false,
    });

    const [sendRes, recvRes] = await Promise.all([s2Send, s2Recv]);

    assert.equal(sendRes.resumedChunks, 3);
    assert.ok(recvRes.resumePlan.newFilePaths.includes("project/new-added.bin"));
    assert.equal(recvRes.files.length, 3);
    assert.deepEqual(recvRes.files[2].bytes, stage2Files[2].bytes);
  } finally {
    await server.close();
  }
});

test("Enhanced Dual-Relay completes when receiver connects BEFORE sender", async () => {
  const server = await createCrocFlowServer({ useViteDev: false, port: 0, host: "127.0.0.1" });
  const { port } = await server.listen(0, "127.0.0.1");
  const baseWsUrl = `ws://127.0.0.1:${port}/ws-dual`;
  const ac = new AbortController();

  try {
    const files = makeTestFiles(false);
    const { adapter } = createMemoryCache();

    // Receiver joins room 150ms BEFORE sender
    const recvPromise = receiveEnhancedTransfer({
      codephrase: "crocflow-receiver-first-42",
      dualRelay: true,
      baseWsUrl,
      wsFactory: nodeWsFactory,
      cache: adapter,
      emitInspector: false,
      signal: ac.signal,
    });
    recvPromise.catch(() => {});

    await new Promise((r) => setTimeout(r, 150));

    const sendPromise = sendEnhancedTransfer({
      files,
      codephrase: "crocflow-receiver-first-42",
      dualRelay: true,
      chunkSize: 16 * 1024,
      baseWsUrl,
      wsFactory: nodeWsFactory,
      emitInspector: false,
      signal: ac.signal,
    });
    sendPromise.catch(() => {});

    const [sendRes, recvRes] = await Promise.race([
      Promise.all([sendPromise, recvPromise]),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("Receiver-first PAKE handshake timed out")), 2000),
      ),
    ]);

    assert.ok(sendRes.alphaDelivered > 0);
    assert.ok(sendRes.betaDelivered > 0);
    assert.deepEqual(recvRes.files[0].bytes, files[0].bytes);
    assert.deepEqual(recvRes.files[1].bytes, files[1].bytes);
  } finally {
    ac.abort();
    (server.httpServer as unknown as { closeAllConnections?: () => void }).closeAllConnections?.();
    await server.close();
  }
});

test("Enhanced Dual-Relay negotiates cleanly when Sender enables dualRelay and Receiver disables it", async () => {
  const server = await createCrocFlowServer({ useViteDev: false, port: 0, host: "127.0.0.1" });
  const { port } = await server.listen(0, "127.0.0.1");
  const baseWsUrl = `ws://127.0.0.1:${port}/ws-dual`;
  const ac = new AbortController();

  try {
    const files = makeTestFiles(false);
    const { adapter } = createMemoryCache();

    const sendPromise = sendEnhancedTransfer({
      files,
      codephrase: "crocflow-mismatch-dual-77",
      dualRelay: true,
      chunkSize: 16 * 1024,
      baseWsUrl,
      wsFactory: nodeWsFactory,
      emitInspector: false,
      signal: ac.signal,
    });
    sendPromise.catch(() => {});

    await new Promise((r) => setTimeout(r, 40));

    const recvPromise = receiveEnhancedTransfer({
      codephrase: "crocflow-mismatch-dual-77",
      dualRelay: false,
      baseWsUrl,
      wsFactory: nodeWsFactory,
      cache: adapter,
      emitInspector: false,
      signal: ac.signal,
    });
    recvPromise.catch(() => {});

    const [sendRes, recvRes] = await Promise.race([
      Promise.all([sendPromise, recvPromise]),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("Dual-Relay mismatch negotiation timed out")), 2000),
      ),
    ]);

    assert.equal(sendRes.betaDelivered, 0);
    assert.equal(sendRes.alphaDelivered, 7);
    assert.deepEqual(recvRes.files[0].bytes, files[0].bytes);
    assert.deepEqual(recvRes.files[1].bytes, files[1].bytes);
  } finally {
    ac.abort();
    (server.httpServer as unknown as { closeAllConnections?: () => void }).closeAllConnections?.();
    await server.close();
  }
});

test("Enhanced Dual-Relay negotiates cleanly when Sender disables dualRelay and Receiver enables it", async () => {
  const server = await createCrocFlowServer({ useViteDev: false, port: 0, host: "127.0.0.1" });
  const { port } = await server.listen(0, "127.0.0.1");
  const baseWsUrl = `ws://127.0.0.1:${port}/ws-dual`;
  const ac = new AbortController();

  try {
    const files = makeTestFiles(false);
    const { adapter } = createMemoryCache();

    const recvPromise = receiveEnhancedTransfer({
      codephrase: "crocflow-mismatch-off-on-88",
      dualRelay: true,
      baseWsUrl,
      wsFactory: nodeWsFactory,
      cache: adapter,
      emitInspector: false,
      signal: ac.signal,
    });
    recvPromise.catch(() => {});

    await new Promise((r) => setTimeout(r, 40));

    const sendPromise = sendEnhancedTransfer({
      files,
      codephrase: "crocflow-mismatch-off-on-88",
      dualRelay: false,
      chunkSize: 16 * 1024,
      baseWsUrl,
      wsFactory: nodeWsFactory,
      emitInspector: false,
      signal: ac.signal,
    });
    sendPromise.catch(() => {});

    const [sendRes, recvRes] = await Promise.race([
      Promise.all([sendPromise, recvPromise]),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("Dual-Relay OFF/ON mismatch negotiation timed out")), 2000),
      ),
    ]);

    assert.equal(sendRes.betaDelivered, 0);
    assert.equal(sendRes.alphaDelivered, 7);
    assert.deepEqual(recvRes.files[0].bytes, files[0].bytes);
    assert.deepEqual(recvRes.files[1].bytes, files[1].bytes);
  } finally {
    ac.abort();
    (server.httpServer as unknown as { closeAllConnections?: () => void }).closeAllConnections?.();
    await server.close();
  }
});

test("Enhanced Dual-Relay survives live Relay Beta disconnect by failing over odd chunks to Alpha", async () => {
  const server = await createCrocFlowServer({ useViteDev: false, port: 0, host: "127.0.0.1" });
  const { port } = await server.listen(0, "127.0.0.1");
  const baseWsUrl = `ws://127.0.0.1:${port}/ws-dual`;
  const ac = new AbortController();

  try {
    const files = makeTestFiles(false); // 7 chunks (0..6)
    const { adapter } = createMemoryCache();
    let betaSocketRef: WebSocketLike | null = null;
    let betaClosed = false;

    const trackingWsFactory = (url: string): WebSocketLike => {
      const ws = nodeWsFactory(url);
      if (url.includes("channel=beta") && url.includes("role=sender")) {
        betaSocketRef = ws;
      }
      return ws;
    };

    const sendPromise = sendEnhancedTransfer({
      files,
      codephrase: "crocflow-beta-failover-88",
      dualRelay: true,
      chunkSize: 16 * 1024,
      chunkDelayMs: 15,
      baseWsUrl,
      wsFactory: trackingWsFactory,
      emitInspector: false,
      signal: ac.signal,
      onProgress: (p) => {
        if (!betaClosed && p.completedChunks >= 2 && betaSocketRef) {
          betaClosed = true;
          betaSocketRef.close(4001, "Simulated Beta outage");
        }
      },
    });
    sendPromise.catch(() => {});

    await new Promise((r) => setTimeout(r, 40));

    const recvPromise = receiveEnhancedTransfer({
      codephrase: "crocflow-beta-failover-88",
      dualRelay: true,
      baseWsUrl,
      wsFactory: nodeWsFactory,
      cache: adapter,
      emitInspector: false,
      signal: ac.signal,
    });
    recvPromise.catch(() => {});

    const [sendRes, recvRes] = await Promise.race([
      Promise.all([sendPromise, recvPromise]),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("Beta failover timed out")), 2000),
      ),
    ]);

    assert.equal(betaClosed, true);
    assert.ok(sendRes.failoverRerouted > 0, "Expected odd chunks rerouted to Alpha");
    assert.deepEqual(recvRes.files[0].bytes, files[0].bytes);
    assert.deepEqual(recvRes.files[1].bytes, files[1].bytes);
  } finally {
    ac.abort();
    (server.httpServer as unknown as { closeAllConnections?: () => void }).closeAllConnections?.();
    await server.close();
  }
});

test("Enhanced Dual-Relay reroutes unacked in-flight chunks when Alpha drops before receiver gets them", async () => {
  const server = await createCrocFlowServer({ useViteDev: false, port: 0, host: "127.0.0.1" });
  const { port } = await server.listen(0, "127.0.0.1");
  const baseWsUrl = `ws://127.0.0.1:${port}/ws-dual`;
  const ac = new AbortController();

  try {
    const files = makeTestFiles(false); // 7 chunks (0..6)
    const { adapter } = createMemoryCache();
    let droppedChunkOnAlpha = false;
    let handleRef: { simulateAlphaDisconnect: () => void } | null = null;

    // Drop the very first encrypted chunk sent on Alpha on receiver side, then trigger Alpha disconnect
    const lossyRecvWsFactory = (url: string): WebSocketLike => {
      const ws = nodeWsFactory(url);
      if (url.includes("channel=alpha") && url.includes("role=receiver")) {
        const protoDesc =
          Object.getOwnPropertyDescriptor(ws, "onmessage") ??
          Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ws), "onmessage");
        let wrappedHandler: ((ev: { data: unknown }) => void) | null = null;
        let seenEncrypted = 0;
        Object.defineProperty(ws, "onmessage", {
          configurable: true,
          get: () => wrappedHandler,
          set: (fn) => {
            wrappedHandler = (ev: { data: unknown }) => {
              const txt = typeof ev.data === "string" ? ev.data : "";
              if (txt.includes('"type":"encrypted"')) {
                seenEncrypted += 1;
                // Let manifest (1st encrypted frame) pass; drop 2nd encrypted frame (chunk 0) and kill Alpha
                if (seenEncrypted === 2 && !droppedChunkOnAlpha) {
                  droppedChunkOnAlpha = true;
                  setTimeout(() => handleRef?.simulateAlphaDisconnect(), 20);
                  return;
                }
              }
              fn?.(ev);
            };
            protoDesc?.set?.call(ws, wrappedHandler);
          },
        });
      }
      return ws;
    };

    const sendPromise = sendEnhancedTransfer({
      files,
      codephrase: "crocflow-unacked-reroute-55",
      dualRelay: true,
      chunkSize: 16 * 1024,
      baseWsUrl,
      wsFactory: nodeWsFactory,
      emitInspector: false,
      signal: ac.signal,
      onHandleReady: (h) => {
        handleRef = h;
      },
    });
    sendPromise.catch(() => {});

    await new Promise((r) => setTimeout(r, 40));

    const recvPromise = receiveEnhancedTransfer({
      codephrase: "crocflow-unacked-reroute-55",
      dualRelay: true,
      baseWsUrl,
      wsFactory: lossyRecvWsFactory,
      cache: adapter,
      emitInspector: false,
      signal: ac.signal,
    });
    recvPromise.catch(() => {});

    const [sendRes, recvRes] = await Promise.race([
      Promise.all([sendPromise, recvPromise]),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("Unacked in-flight chunk was never rerouted")), 2000),
      ),
    ]);

    assert.equal(droppedChunkOnAlpha, true);
    assert.ok(sendRes.failoverRerouted >= 1);
    assert.deepEqual(recvRes.files[0].bytes, files[0].bytes);
    assert.deepEqual(recvRes.files[1].bytes, files[1].bytes);
  } finally {
    ac.abort();
    (server.httpServer as unknown as { closeAllConnections?: () => void }).closeAllConnections?.();
    await server.close();
  }
});

test("resolvePublicDualRelayPlan deterministically assigns distinct Alpha and Beta relays from codephrase", async () => {
  const relays = [
    "1.getcroc.com:9009",
    "2.getcroc.com:9009",
    "3.getcroc.com:9009",
    "4.getcroc.com:9009",
  ];
  const p1 = await resolvePublicDualRelayPlan("4281-mango-solar-river", relays);
  const p2 = await resolvePublicDualRelayPlan("4281-mango-solar-river", relays);
  assert.deepEqual(p1, p2);
  assert.notEqual(p1.alphaIndex, p1.betaIndex);
  assert.equal(p1.dualRelaySupported, true);

  const single = await resolvePublicDualRelayPlan("4281-mango-solar-river", ["custom.relay:9009"]);
  assert.equal(single.alphaIndex, 0);
  assert.equal(single.betaIndex, 0);
  assert.equal(single.alphaPort, "9009");
  assert.equal(single.betaPort, "9009");
  assert.equal(single.dualRelaySupported, false);
});

function createVirtualCrocConnector() {
  const rooms = new Map<string, Array<{ pushFrame: (bytes: Uint8Array) => void; close: () => void }>>();
  const dialedRooms: string[] = [];

  function createVirtualCrocSocket(roomKey: string) {
    const decoder = new FrameDecoder();
    const queue: Uint8Array[] = [];
    const waiters: Array<{ resolve: (v: Uint8Array) => void; reject: (e: Error) => void }> = [];
    let closedErr: Error | null = null;

    const peerObj = {
      pushFrame(chunk: Uint8Array) {
        if (closedErr) return;
        for (const msg of decoder.push(chunk)) {
          if (msg.byteLength === 1 && msg[0] === 1) continue;
          const w = waiters.shift();
          if (w) w.resolve(msg);
          else queue.push(msg);
        }
      },
      close() {
        if (closedErr) return;
        closedErr = new Error("Relay connection closed");
        while (waiters.length > 0) waiters.shift()!.reject(closedErr);
      },
    };

    const list = rooms.get(roomKey) ?? [];
    list.push(peerObj);
    rooms.set(roomKey, list);

    const sock = {
      async send(payload: Uint8Array) {
        if (closedErr) throw closedErr;
        const framed = encodeFrame(payload);
        for (const p of rooms.get(roomKey) ?? []) {
          if (p !== peerObj) p.pushFrame(framed);
        }
      },
      async receive(skipPings = true) {
        for (;;) {
          if (queue.length > 0) {
            const m = queue.shift()!;
            if (skipPings && m.byteLength === 1 && m[0] === 1) continue;
            return m;
          }
          if (closedErr) throw closedErr;
          const m = await new Promise<Uint8Array>((resolve, reject) => waiters.push({ resolve, reject }));
          if (skipPings && m.byteLength === 1 && m[0] === 1) continue;
          return m;
        }
      },
      close() {
        peerObj.close();
      },
    };
    return sock as unknown as CrocSocket;
  }

  const fakeConnectRelay = async (
    _settings: unknown,
    room: string,
    _port: string,
    relayIndex: number,
  ) => {
    dialedRooms.push(room);
    const socket = createVirtualCrocSocket(`${relayIndex}::${room}`);
    return { socket, banner: "9009,9010", externalIP: "127.0.0.1" };
  };

  return { fakeConnectRelay, dialedRooms };
}

test("Enhanced Dual-Relay with relayProfile='public' streams across two Croc-framed relay channels and handles Alpha failover", async () => {
  const { fakeConnectRelay } = createVirtualCrocConnector();

  const files = makeTestFiles(false);
  const { adapter } = createMemoryCache();
  const publicSettings = {
    bridgeURL: "ws://unused/ws",
    relayAddresses: ["1.getcroc.com:9009", "2.getcroc.com:9009", "3.getcroc.com:9009", "4.getcroc.com:9009"],
    relayPassword: "pass123",
  };
  let handleRef: { simulateAlphaDisconnect: () => void } | null = null;
  let failoverTriggered = false;

  const sendPromise = sendEnhancedTransfer({
    files,
    codephrase: "4281-public-dual-test",
    dualRelay: true,
    relayProfile: "public",
    publicRelaySettings: publicSettings,
    publicConnectRelay: fakeConnectRelay as never,
    chunkSize: 16 * 1024,
    chunkDelayMs: 10,
    emitInspector: false,
    onHandleReady: (h) => {
      handleRef = h;
    },
    onProgress: (p) => {
      if (!failoverTriggered && p.completedChunks >= 2) {
        failoverTriggered = true;
        handleRef?.simulateAlphaDisconnect();
      }
    },
  });

  const recvPromise = receiveEnhancedTransfer({
    codephrase: "4281-public-dual-test",
    dualRelay: true,
    relayProfile: "public",
    publicRelaySettings: publicSettings,
    publicConnectRelay: fakeConnectRelay as never,
    cache: adapter,
    emitInspector: false,
  });

  const [sendRes, recvRes] = await Promise.all([sendPromise, recvPromise]);
  assert.equal(failoverTriggered, true);
  assert.ok(sendRes.failoverRerouted > 0);
  assert.deepEqual(recvRes.files[0].bytes, files[0].bytes);
  assert.deepEqual(recvRes.files[1].bytes, files[1].bytes);
});

test("receiveEnhancedTransfer aborts promptly while waiting for PAKE reply", async () => {
  const server = await createCrocFlowServer({ useViteDev: false, port: 0, host: "127.0.0.1" });
  const { port } = await server.listen(0, "127.0.0.1");
  const baseWsUrl = `ws://127.0.0.1:${port}/ws-dual`;
  const ac = new AbortController();

  try {
    const { adapter } = createMemoryCache();
    setTimeout(() => ac.abort(), 120);
    await assert.rejects(
      () =>
        receiveEnhancedTransfer({
          codephrase: "crocflow-cancel-mid-pake",
          dualRelay: true,
          baseWsUrl,
          wsFactory: nodeWsFactory,
          cache: adapter,
          emitInspector: false,
          signal: ac.signal,
        }),
      (err: unknown) => err instanceof DOMException && err.name === "AbortError",
    );
  } finally {
    (server.httpServer as unknown as { closeAllConnections?: () => void }).closeAllConnections?.();
    await server.close();
  }
});

test("Enhanced Dual-Relay finishes cleanly even when Beta is faster and complete overtakes Alpha trailing chunk-ack", async () => {
  const server = await createCrocFlowServer({ useViteDev: false, port: 0, host: "127.0.0.1" });
  const { port } = await server.listen(0, "127.0.0.1");
  const baseWsUrl = `ws://127.0.0.1:${port}/ws-dual`;
  const ac = new AbortController();

  try {
    const files = makeTestFiles(false); // 7 chunks
    const { adapter } = createMemoryCache();

    // Delay all incoming frames on Sender's Alpha channel by 150ms so Beta's `complete` arrives before Alpha's last `chunk-ack`
    const asymmetricSenderWsFactory = (url: string): WebSocketLike => {
      const ws = nodeWsFactory(url);
      if (url.includes("channel=alpha") && url.includes("role=sender")) {
        const protoDesc =
          Object.getOwnPropertyDescriptor(ws, "onmessage") ??
          Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ws), "onmessage");
        let wrappedHandler: ((ev: { data: unknown }) => void) | null = null;
        Object.defineProperty(ws, "onmessage", {
          configurable: true,
          get: () => wrappedHandler,
          set: (fn) => {
            wrappedHandler = (ev: { data: unknown }) => {
              const txt = typeof ev.data === "string" ? ev.data : "";
              if (txt.includes('"type":"encrypted"')) {
                setTimeout(() => fn?.(ev), 150);
                return;
              }
              fn?.(ev);
            };
            protoDesc?.set?.call(ws, wrappedHandler);
          },
        });
      }
      return ws;
    };

    const sendPromise = sendEnhancedTransfer({
      files,
      codephrase: "crocflow-asymmetric-rtt-complete",
      dualRelay: true,
      chunkSize: 16 * 1024,
      baseWsUrl,
      wsFactory: asymmetricSenderWsFactory,
      emitInspector: false,
      signal: ac.signal,
    });

    await new Promise((r) => setTimeout(r, 40));

    const recvPromise = receiveEnhancedTransfer({
      codephrase: "crocflow-asymmetric-rtt-complete",
      dualRelay: true,
      baseWsUrl,
      wsFactory: nodeWsFactory,
      cache: adapter,
      emitInspector: false,
      signal: ac.signal,
    });

    const [sendRes, recvRes] = await Promise.race([
      Promise.all([sendPromise, recvPromise]),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("Asymmetric RTT complete race timed out")), 3000),
      ),
    ]);

    assert.equal(sendRes.alphaDelivered + sendRes.betaDelivered, 7);
    assert.deepEqual(recvRes.files[0].bytes, files[0].bytes);
    assert.deepEqual(recvRes.files[1].bytes, files[1].bytes);
  } finally {
    ac.abort();
    (server.httpServer as unknown as { closeAllConnections?: () => void }).closeAllConnections?.();
    await server.close();
  }
});

test("Enhanced Dual-Relay with relayProfile='public' and 1 relay narrows to single-lane Alpha without dialing Beta", async () => {
  const { fakeConnectRelay, dialedRooms } = createVirtualCrocConnector();
  const files = makeTestFiles(false); // 7 chunks
  const { adapter } = createMemoryCache();
  const singleRelaySettings = {
    bridgeURL: "ws://unused/ws",
    relayAddresses: ["solo.croc.example:9009"],
    relayPassword: "pass123",
  };
  const recvBetaStates: Array<boolean | undefined> = [];

  const sendPromise = sendEnhancedTransfer({
    files,
    codephrase: "4281-public-single-fallback",
    dualRelay: true,
    relayProfile: "public",
    publicRelaySettings: singleRelaySettings,
    publicConnectRelay: fakeConnectRelay as never,
    chunkSize: 16 * 1024,
    emitInspector: false,
  });

  await new Promise((r) => setTimeout(r, 20));

  const recvPromise = receiveEnhancedTransfer({
    codephrase: "4281-public-single-fallback",
    dualRelay: true,
    relayProfile: "public",
    publicRelaySettings: singleRelaySettings,
    publicConnectRelay: fakeConnectRelay as never,
    cache: adapter,
    emitInspector: false,
    onProgress: (p) => recvBetaStates.push(p.betaAlive),
  });

  const [sendRes, recvRes] = await Promise.race([
    Promise.all([sendPromise, recvPromise]),
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error("1-relay public single-lane fallback timed out")), 3000),
    ),
  ]);

  assert.equal(dialedRooms.some((r) => r.endsWith("-beta")), false);
  assert.equal(sendRes.alphaDelivered, 7);
  assert.equal(sendRes.betaDelivered, 0);
  assert.equal(recvBetaStates.every((v) => v === undefined), true);
  assert.deepEqual(recvRes.files[0].bytes, files[0].bytes);
  assert.deepEqual(recvRes.files[1].bytes, files[1].bytes);
});

test("Enhanced Dual-Relay completes SPAKE2 PAKE over Beta when Alpha closes/stalls during handshake", async () => {
  const server = await createCrocFlowServer({ useViteDev: false, port: 0, host: "127.0.0.1" });
  const { port } = await server.listen(0, "127.0.0.1");
  const baseWsUrl = `ws://127.0.0.1:${port}/ws-dual`;
  const ac = new AbortController();

  try {
    const files = makeTestFiles(false);
    const { adapter } = createMemoryCache();

    // Drop all PAKE/control traffic on Sender's Alpha channel and close Alpha during handshake
    const brokenAlphaSenderWsFactory = (url: string): WebSocketLike => {
      const ws = nodeWsFactory(url);
      if (url.includes("channel=alpha") && url.includes("role=sender")) {
        const origSend = ws.send.bind(ws);
        ws.send = (data) => {
          if (typeof data === "string" && data.includes("pake-")) {
            ws.close(4002, "Alpha died during PAKE");
            return;
          }
          origSend(data);
        };
        setTimeout(() => {
          try {
            ws.close(4002, "Alpha died during PAKE");
          } catch {}
        }, 30);
      }
      return ws;
    };

    const recvPromise = receiveEnhancedTransfer({
      codephrase: "crocflow-pake-beta-fallback",
      dualRelay: true,
      baseWsUrl,
      wsFactory: nodeWsFactory,
      cache: adapter,
      emitInspector: false,
      signal: ac.signal,
    });
    recvPromise.catch(() => {});

    await new Promise((r) => setTimeout(r, 60));

    const sendPromise = sendEnhancedTransfer({
      files,
      codephrase: "crocflow-pake-beta-fallback",
      dualRelay: true,
      chunkSize: 16 * 1024,
      baseWsUrl,
      wsFactory: brokenAlphaSenderWsFactory,
      emitInspector: false,
      signal: ac.signal,
    });
    sendPromise.catch(() => {});

    const [sendRes, recvRes] = await Promise.race([
      Promise.all([sendPromise, recvPromise]),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("PAKE Beta fallback timed out")), 3000),
      ),
    ]);

    assert.equal(sendRes.alphaDelivered, 0);
    assert.equal(sendRes.betaDelivered, 7);
    assert.deepEqual(recvRes.files[0].bytes, files[0].bytes);
    assert.deepEqual(recvRes.files[1].bytes, files[1].bytes);
  } finally {
    ac.abort();
    (server.httpServer as unknown as { closeAllConnections?: () => void }).closeAllConnections?.();
    await server.close();
  }
});

test("Enhanced Dual-Relay recovers if initial pake-confirm is dropped before reaching Sender", async () => {
  const server = await createCrocFlowServer({ useViteDev: false, port: 0, host: "127.0.0.1" });
  const { port } = await server.listen(0, "127.0.0.1");
  const baseWsUrl = `ws://127.0.0.1:${port}/ws-dual`;
  const ac = new AbortController();

  try {
    const files = makeTestFiles(false);
    const { adapter } = createMemoryCache();
    let droppedConfirmCount = 0;

    // Drop the very first `pake-confirm` on Sender side (both lanes) to test Receiver's confirm retry
    const dropFirstConfirmWsFactory = (url: string): WebSocketLike => {
      const ws = nodeWsFactory(url);
      if (url.includes("role=sender")) {
        const protoDesc =
          Object.getOwnPropertyDescriptor(ws, "onmessage") ??
          Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ws), "onmessage");
        let wrappedHandler: ((ev: { data: unknown }) => void) | null = null;
        Object.defineProperty(ws, "onmessage", {
          configurable: true,
          get: () => wrappedHandler,
          set: (fn) => {
            wrappedHandler = (ev: { data: unknown }) => {
              const txt = typeof ev.data === "string" ? ev.data : "";
              if (txt.includes('"type":"pake-confirm"') && droppedConfirmCount < 2) {
                droppedConfirmCount += 1;
                return;
              }
              fn?.(ev);
            };
            protoDesc?.set?.call(ws, wrappedHandler);
          },
        });
      }
      return ws;
    };

    const sendPromise = sendEnhancedTransfer({
      files,
      codephrase: "crocflow-confirm-retry-11",
      dualRelay: true,
      chunkSize: 16 * 1024,
      baseWsUrl,
      wsFactory: dropFirstConfirmWsFactory,
      emitInspector: false,
      signal: ac.signal,
    });

    await new Promise((r) => setTimeout(r, 30));

    const recvPromise = receiveEnhancedTransfer({
      codephrase: "crocflow-confirm-retry-11",
      dualRelay: true,
      baseWsUrl,
      wsFactory: nodeWsFactory,
      cache: adapter,
      emitInspector: false,
      signal: ac.signal,
    });

    const [sendRes, recvRes] = await Promise.race([
      Promise.all([sendPromise, recvPromise]),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("pake-confirm retry timed out")), 3000),
      ),
    ]);

    assert.equal(droppedConfirmCount, 2);
    assert.equal(sendRes.alphaDelivered + sendRes.betaDelivered, 7);
    assert.deepEqual(recvRes.files[0].bytes, files[0].bytes);
    assert.deepEqual(recvRes.files[1].bytes, files[1].bytes);
  } finally {
    ac.abort();
    (server.httpServer as unknown as { closeAllConnections?: () => void }).closeAllConnections?.();
    await server.close();
  }
});

test("Enhanced SPAKE2 PAKE rejects mismatched codephrase in the same room immediately", async () => {
  const server = await createCrocFlowServer({ useViteDev: false, port: 0, host: "127.0.0.1" });
  const { port } = await server.listen(0, "127.0.0.1");
  const baseWsUrl = `ws://127.0.0.1:${port}/ws-dual`;
  const ac = new AbortController();

  try {
    const files = makeTestFiles(false);
    const { adapter } = createMemoryCache();

    // Force both peers into the same physical room while holding different codephrases
    const sharedRoomWsFactory = (url: string): WebSocketLike => {
      const parsed = new URL(url);
      parsed.searchParams.set("room", "cf-forced-collision-room");
      return nodeWsFactory(parsed.toString());
    };

    const sendPromise = sendEnhancedTransfer({
      files,
      codephrase: "sender-secret-alpha",
      dualRelay: false,
      chunkSize: 16 * 1024,
      baseWsUrl,
      wsFactory: sharedRoomWsFactory,
      emitInspector: false,
      signal: ac.signal,
    });

    await new Promise((r) => setTimeout(r, 30));

    const recvPromise = receiveEnhancedTransfer({
      codephrase: "receiver-wrong-beta",
      dualRelay: false,
      baseWsUrl,
      wsFactory: sharedRoomWsFactory,
      cache: adapter,
      emitInspector: false,
      signal: ac.signal,
    });

    await assert.rejects(() => recvPromise, /Mã bí mật không khớp/);
    ac.abort();
    await sendPromise.catch(() => undefined);
  } finally {
    ac.abort();
    (server.httpServer as unknown as { closeAllConnections?: () => void }).closeAllConnections?.();
    await server.close();
  }
});

test("Enhanced Dual-Relay negotiates down to Beta when Receiver Alpha dies during PAKE while Sender Alpha remains open", async () => {
  const server = await createCrocFlowServer({ useViteDev: false, port: 0, host: "127.0.0.1" });
  const { port } = await server.listen(0, "127.0.0.1");
  const baseWsUrl = `ws://127.0.0.1:${port}/ws-dual`;
  const ac = new AbortController();

  try {
    const files = makeTestFiles(false);
    const { adapter } = createMemoryCache();

    const recvDropAlphaWsFactory = (url: string): WebSocketLike => {
      const ws = nodeWsFactory(url);
      if (url.includes("channel=alpha") && url.includes("role=receiver")) {
        const rawWs = ws as unknown as WebSocket;
        rawWs.once("open", () => {
          setTimeout(() => {
            try {
              ws.close(4003, "Receiver Alpha dropped during PAKE");
            } catch {}
          }, 25);
        });
      }
      return ws;
    };

    const sendPromise = sendEnhancedTransfer({
      files,
      codephrase: "crocflow-recv-alpha-drop-pake",
      dualRelay: true,
      chunkSize: 16 * 1024,
      baseWsUrl,
      wsFactory: nodeWsFactory,
      emitInspector: false,
      signal: ac.signal,
    });
    sendPromise.catch(() => {});

    await new Promise((r) => setTimeout(r, 40));

    const recvPromise = receiveEnhancedTransfer({
      codephrase: "crocflow-recv-alpha-drop-pake",
      dualRelay: true,
      baseWsUrl,
      wsFactory: recvDropAlphaWsFactory,
      cache: adapter,
      emitInspector: false,
      signal: ac.signal,
    });
    recvPromise.catch(() => {});

    const [sendRes, recvRes] = await Promise.race([
      Promise.all([sendPromise, recvPromise]),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("Asymmetric Receiver Alpha drop hung")), 3000),
      ),
    ]);

    assert.equal(sendRes.alphaDelivered, 0);
    assert.equal(sendRes.betaDelivered, 7);
    assert.deepEqual(recvRes.files[0].bytes, files[0].bytes);
    assert.deepEqual(recvRes.files[1].bytes, files[1].bytes);
  } finally {
    ac.abort();
    (server.httpServer as unknown as { closeAllConnections?: () => void }).closeAllConnections?.();
    await server.close();
  }
});

test("Enhanced Dual-Relay watchdog fails over silent/zombie Alpha lane to healthy Beta lane", async () => {
  const server = await createCrocFlowServer({ useViteDev: false, port: 0, host: "127.0.0.1" });
  const { port } = await server.listen(0, "127.0.0.1");
  const baseWsUrl = `ws://127.0.0.1:${port}/ws-dual`;
  const ac = new AbortController();

  try {
    const files = makeTestFiles(false);
    const { adapter } = createMemoryCache();

    // Sender's Alpha connects to a silent zombie room (stays open, never closes, never reaches receiver)
    const zombieAlphaSenderWsFactory = (url: string): WebSocketLike => {
      const parsed = new URL(url);
      if (parsed.searchParams.get("channel") === "alpha") {
        parsed.searchParams.set("room", `${parsed.searchParams.get("room")}-zombie`);
      }
      return nodeWsFactory(parsed.toString());
    };

    const sendPromise = sendEnhancedTransfer({
      files,
      codephrase: "crocflow-zombie-alpha-watchdog",
      dualRelay: true,
      chunkSize: 16 * 1024,
      baseWsUrl,
      wsFactory: zombieAlphaSenderWsFactory,
      emitInspector: false,
      signal: ac.signal,
    });
    sendPromise.catch(() => {});

    await new Promise((r) => setTimeout(r, 40));

    const recvPromise = receiveEnhancedTransfer({
      codephrase: "crocflow-zombie-alpha-watchdog",
      dualRelay: true,
      baseWsUrl,
      wsFactory: nodeWsFactory,
      cache: adapter,
      emitInspector: false,
      signal: ac.signal,
    });
    recvPromise.catch(() => {});

    const [sendRes, recvRes] = await Promise.race([
      Promise.all([sendPromise, recvPromise]),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("Zombie Alpha watchdog timed out")), 6000),
      ),
    ]);

    assert.equal(sendRes.alphaDelivered, 0);
    assert.equal(sendRes.betaDelivered, 7);
    assert.ok(sendRes.failoverRerouted > 0);
    assert.deepEqual(recvRes.files[0].bytes, files[0].bytes);
    assert.deepEqual(recvRes.files[1].bytes, files[1].bytes);
  } finally {
    ac.abort();
    (server.httpServer as unknown as { closeAllConnections?: () => void }).closeAllConnections?.();
    await server.close();
  }
});

test("Enhanced Dual-Relay with relayProfile='public' falls back to Beta when Alpha connect fails", async () => {
  const { fakeConnectRelay } = createVirtualCrocConnector();
  const files = makeTestFiles(false);
  const { adapter } = createMemoryCache();
  const publicSettings = {
    bridgeURL: "ws://unused/ws",
    relayAddresses: ["1.getcroc.com:9009", "2.getcroc.com:9009", "3.getcroc.com:9009", "4.getcroc.com:9009"],
    relayPassword: "pass123",
  };

  const alphaFailsForSender = async (
    settings: unknown,
    room: string,
    port: string,
    relayIndex: number,
  ) => {
    if (room.endsWith("-alpha")) {
      throw new Error("Simulated Alpha relay unreachable");
    }
    return fakeConnectRelay(settings, room, port, relayIndex);
  };

  const sendPromise = sendEnhancedTransfer({
    files,
    codephrase: "4281-public-beta-only-fallback",
    dualRelay: true,
    relayProfile: "public",
    publicRelaySettings: publicSettings,
    publicConnectRelay: alphaFailsForSender as never,
    chunkSize: 16 * 1024,
    emitInspector: false,
  });

  await new Promise((r) => setTimeout(r, 20));

  const recvPromise = receiveEnhancedTransfer({
    codephrase: "4281-public-beta-only-fallback",
    dualRelay: true,
    relayProfile: "public",
    publicRelaySettings: publicSettings,
    publicConnectRelay: fakeConnectRelay as never,
    cache: adapter,
    emitInspector: false,
  });

  const [sendRes, recvRes] = await Promise.race([
    Promise.all([sendPromise, recvPromise]),
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error("Public Alpha-failure Beta-fallback timed out")), 3000),
    ),
  ]);

  assert.equal(sendRes.alphaDelivered, 0);
  assert.equal(sendRes.betaDelivered, 7);
  assert.deepEqual(recvRes.files[0].bytes, files[0].bytes);
  assert.deepEqual(recvRes.files[1].bytes, files[1].bytes);
});
