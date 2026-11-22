import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createCrocFlowServer } from "../server.ts";

test("Unified server serves /healthz, /config.js, /api/relays/status, and rejects disallowed /ws targets", async () => {
  const server = await createCrocFlowServer({ useViteDev: false, port: 0, host: "127.0.0.1" });
  const { port } = await server.listen(0, "127.0.0.1");
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const health = await fetch(`${baseUrl}/healthz`);
    assert.equal(health.status, 200);
    assert.equal((await health.text()).trim(), "ok");

    const configJs = await fetch(`${baseUrl}/config.js`);
    assert.equal(configJs.status, 200);
    const configBody = await configJs.text();
    assert.match(configBody, /window\.__CROC_RUNTIME_CONFIG__/);
    assert.match(configBody, /1\.getcroc\.com:9009/);

    const relayStatus = await fetch(`${baseUrl}/api/relays/status`);
    assert.equal(relayStatus.status, 200);
    const statusJson = (await relayStatus.json()) as {
      publicRelays: Array<{ host: string }>;
      localDualRelay: { alpha: { online: boolean }; beta: { online: boolean } };
    };
    assert.equal(statusJson.publicRelays.length, 4);
    assert.equal(statusJson.localDualRelay.alpha.online, true);
    assert.equal(statusJson.localDualRelay.beta.online, true);

    // Disallowed port must be rejected with 403 on WebSocket upgrade
    const rejectedStatus = await new Promise<number>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?relay=0&port=22`);
      ws.once("unexpected-response", (_req, res) => {
        resolve(res.statusCode ?? 0);
      });
      ws.once("open", () => {
        ws.close();
        reject(new Error("Disallowed port should never open"));
      });
      ws.once("error", () => {
        // Expected right after unexpected-response
      });
    });
    assert.equal(rejectedStatus, 403);

    // Invalid relay index must be rejected with 400
    const badIndexStatus = await new Promise<number>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?relay=evil&port=9009`);
      ws.once("unexpected-response", (_req, res) => {
        resolve(res.statusCode ?? 0);
      });
      ws.once("open", () => {
        ws.close();
        reject(new Error("Invalid relay index should never open"));
      });
      ws.once("error", () => {});
    });
    assert.equal(badIndexStatus, 400);
  } finally {
    await server.close();
  }
});
