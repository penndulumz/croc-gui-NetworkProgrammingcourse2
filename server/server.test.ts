import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocket } from "ws";
import { createCrocFlowServer } from "../server.ts";
import { LocalDualRelayNode } from "./local-dual-relay.ts";

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
    assert.match(configBody, /"bridgeURL":"\/ws"/);
    assert.match(configBody, /1\.getcroc\.com:9009/);

    assert.ok(server.dualRelayNode instanceof LocalDualRelayNode);

    const relayStatus = await fetch(`${baseUrl}/api/relays/status`);
    assert.equal(relayStatus.status, 200);
    const statusJson = (await relayStatus.json()) as {
      publicRelays: Array<{ host: string }>;
      localDualRelay: {
        alpha: { online: boolean; chunksRelayed: number };
        beta: { online: boolean; chunksRelayed: number };
      };
    };
    assert.equal(statusJson.publicRelays.length, 4);
    assert.equal(statusJson.localDualRelay.alpha.online, true);
    assert.equal(statusJson.localDualRelay.beta.online, true);
    assert.equal(typeof statusJson.localDualRelay.alpha.chunksRelayed, "number");
    assert.equal(typeof statusJson.localDualRelay.beta.chunksRelayed, "number");

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

test("Production SPA fallback serves index.html for unknown client routes without shadowing API routes", async () => {
  // Dot-prefixed dir mimics installs like AppImage /tmp/.mount_* (send dotfile guard).
  const distDir = await mkdtemp(path.join(os.tmpdir(), ".crocflow-dist-"));
  const indexHtml = "<!doctype html><title>CrocFlow SPA</title><div id=root></div>";
  await writeFile(path.join(distDir, "index.html"), indexHtml);
  await writeFile(path.join(distDir, "app.js"), "console.log('asset');");

  const previousDistDir = process.env.CROCFLOW_DIST_DIR;
  process.env.CROCFLOW_DIST_DIR = distDir;
  const server = await createCrocFlowServer({ useViteDev: false, port: 0, host: "127.0.0.1" });
  const { port } = await server.listen(0, "127.0.0.1");
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    for (const spaPath of ["/relays", "/some/spa/path", "/"]) {
      const res = await fetch(`${baseUrl}${spaPath}`);
      assert.equal(res.status, 200, `GET ${spaPath}`);
      assert.match(res.headers.get("content-type") ?? "", /text\/html/);
      assert.equal(await res.text(), indexHtml);
    }

    const asset = await fetch(`${baseUrl}/app.js`);
    assert.equal(asset.status, 200);
    assert.equal(await asset.text(), "console.log('asset');");

    const health = await fetch(`${baseUrl}/healthz`);
    assert.equal(health.status, 200);
    assert.equal((await health.text()).trim(), "ok");

    const relayStatus = await fetch(`${baseUrl}/api/relays/status`);
    assert.equal(relayStatus.status, 200);
    assert.match(relayStatus.headers.get("content-type") ?? "", /application\/json/);
    const statusJson = (await relayStatus.json()) as { publicRelays: unknown[] };
    assert.ok(Array.isArray(statusJson.publicRelays));

    // Non-GET requests must not be answered with the SPA shell.
    const post = await fetch(`${baseUrl}/relays`, { method: "POST" });
    assert.equal(post.status, 404);
    await post.text();
  } finally {
    await server.close();
    if (previousDistDir === undefined) delete process.env.CROCFLOW_DIST_DIR;
    else process.env.CROCFLOW_DIST_DIR = previousDistDir;
    await rm(distDir, { recursive: true, force: true });
  }
});

test("server.ts registers no bare \"*\" route (throws under Express 5 / path-to-regexp v8)", async () => {
  const serverSource = await readFile(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "server.ts"),
    "utf8",
  );
  assert.doesNotMatch(serverSource, /\.(get|use|all|post|put|delete|head|route)\(\s*["'`]\*["'`]/);
});
