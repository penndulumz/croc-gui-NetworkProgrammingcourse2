import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createCrocFlowServer } from "../server.ts";
import { LocalDualRelayNode } from "./local-dual-relay.ts";

function openWs(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
  });
}

function nextMessage(ws: WebSocket, predicate?: (msg: string) => boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for WebSocket message"));
    }, 3000);

    const onMessage = (raw: Buffer | ArrayBuffer | Buffer[]) => {
      const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw);
      if (!predicate || predicate(text)) {
        cleanup();
        resolve(text);
      }
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      clearTimeout(timer);
      ws.off("message", onMessage);
      ws.off("error", onError);
    };

    ws.on("message", onMessage);
    ws.once("error", onError);
  });
}

test("Local Dual-Relay Lab pairs sender and receiver across Alpha and Beta, isolates rooms, and responds to ping", async () => {
  const server = await createCrocFlowServer({ useViteDev: false, port: 0, host: "127.0.0.1" });
  const { port } = await server.listen(0, "127.0.0.1");

  try {
    // 1. Verify HTTP ping endpoints for local Alpha and Beta
    const pingAlpha = await fetch(`http://127.0.0.1:${port}/api/relays/ping?target=alpha`);
    assert.equal(pingAlpha.status, 200);
    const alphaJson = (await pingAlpha.json()) as { ok: boolean; rttMs: number; target: string };
    assert.equal(alphaJson.ok, true);
    assert.equal(alphaJson.target, "alpha");
    assert.ok(alphaJson.rttMs >= 0);

    const pingBeta = await fetch(`http://127.0.0.1:${port}/api/relays/ping?target=beta`);
    assert.equal(pingBeta.status, 200);
    const betaJson = (await pingBeta.json()) as { ok: boolean; rttMs: number; target: string };
    assert.equal(betaJson.ok, true);
    assert.equal(betaJson.target, "beta");

    // 2. Pair Sender & Receiver on Relay Alpha (even chunk) and Relay Beta (odd chunk)
    const senderAlpha = await openWs(`ws://127.0.0.1:${port}/ws-dual?channel=alpha&room=room-dual-1&role=sender`);
    const receiverAlpha = await openWs(`ws://127.0.0.1:${port}/ws-dual?channel=alpha&room=room-dual-1&role=receiver`);
    const senderBeta = await openWs(`ws://127.0.0.1:${port}/ws-dual?channel=beta&room=room-dual-1&role=sender`);
    const receiverBeta = await openWs(`ws://127.0.0.1:${port}/ws-dual?channel=beta&room=room-dual-1&role=receiver`);

    // Unrelated room observer must NOT receive messages from room-dual-1
    const isolatedPeer = await openWs(`ws://127.0.0.1:${port}/ws-dual?channel=alpha&room=other-room-9&role=receiver`);
    let leaked = false;
    isolatedPeer.on("message", (m) => {
      if (m.toString("utf8").includes("chunk-0")) leaked = true;
    });

    // Ping/pong over WebSocket
    const pongPromise = nextMessage(senderAlpha, (m) => m === "__pong__");
    senderAlpha.send("__ping__");
    assert.equal(await pongPromise, "__pong__");

    // Forward chunk-0 over Alpha and chunk-1 over Beta
    const rx0 = nextMessage(receiverAlpha, (m) => m.includes("chunk-0"));
    const rx1 = nextMessage(receiverBeta, (m) => m.includes("chunk-1"));
    senderAlpha.send(JSON.stringify({ type: "chunk", index: 0, tag: "chunk-0" }));
    senderBeta.send(JSON.stringify({ type: "chunk", index: 1, tag: "chunk-1" }));

    assert.match(await rx0, /chunk-0/);
    assert.match(await rx1, /chunk-1/);
    assert.equal(leaked, false);

    // 3. Simulate Relay Alpha disconnect -> Beta continues delivering rerouted even chunk-2
    senderAlpha.close();
    const rx2Failover = nextMessage(receiverBeta, (m) => m.includes("chunk-2-failover"));
    senderBeta.send(JSON.stringify({ type: "chunk", index: 2, tag: "chunk-2-failover" }));
    assert.match(await rx2Failover, /chunk-2-failover/);

    receiverAlpha.close();
    senderBeta.close();
    receiverBeta.close();
    isolatedPeer.close();

    // 4. Verify LocalDualRelayNode stats reflect chunks relayed
    assert.ok(server.dualRelayNode instanceof LocalDualRelayNode);
    const stats = server.dualRelayNode.getStats();
    assert.ok(stats.alpha.chunksRelayed >= 1, "Expected Alpha chunksRelayed >= 1");
    assert.ok(stats.beta.chunksRelayed >= 2, "Expected Beta chunksRelayed >= 2");
  } finally {
    await server.close();
  }
});

test("LocalDualRelayNode initializes with zeroed chunksRelayed and tracks channels cleanly", () => {
  const node = new LocalDualRelayNode();
  const stats = node.getStats();
  assert.equal(stats.alpha.chunksRelayed, 0);
  assert.equal(stats.beta.chunksRelayed, 0);
  assert.equal(stats.alpha.online, true);
  assert.equal(stats.beta.online, true);
});
