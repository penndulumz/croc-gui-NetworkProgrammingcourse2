import test from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import { createCrocFlowServer } from "../../../server";
import {
  receiveEnhancedTransfer,
  sendEnhancedTransfer,
  type ChunkCacheAdapter,
  type WebSocketLike,
} from "./enhanced-client";
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
