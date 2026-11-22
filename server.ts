import express from "express";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, type WebSocket } from "ws";
import {
  parseBridgeConfig,
  resolveAllowedTarget,
  type BridgeConfig,
} from "./server/bridge-allowlist.ts";
import {
  isValidLocalChannel,
  isValidRoomId,
  LocalDualRelayHub,
} from "./server/local-dual-relay.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface CrocFlowServerOptions {
  port?: number;
  host?: string;
  useViteDev?: boolean;
  bridgeConfig?: BridgeConfig;
}

function measureTcpRtt(host: string, port: number, timeoutMs = 2500): Promise<{ ok: boolean; rttMs: number | null; error?: string }> {
  return new Promise((resolve) => {
    const started = performance.now();
    const socket = net.createConnection({ host, port });
    let settled = false;

    const finish = (result: { ok: boolean; rttMs: number | null; error?: string }) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      finish({ ok: true, rttMs: Math.round((performance.now() - started) * 10) / 10 });
    });
    socket.once("timeout", () => {
      finish({ ok: false, rttMs: null, error: "Connection timed out" });
    });
    socket.once("error", (err) => {
      finish({ ok: false, rttMs: null, error: err.message });
    });
  });
}

export async function createCrocFlowServer(options: CrocFlowServerOptions = {}) {
  const bridgeConfig = options.bridgeConfig ?? parseBridgeConfig(process.env);
  const dualRelayHub = new LocalDualRelayHub();
  const app = express();

  app.disable("x-powered-by");

  app.get("/healthz", (_req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.status(200).send("ok\n");
  });

  app.get("/config.js", (_req, res) => {
    const controlPort = bridgeConfig.allowedPorts[0] || "9009";
    const runtimeConfig = {
      gatewayURL: "/ws",
      localDualRelayURL: "/ws-dual",
      relayAddresses: bridgeConfig.relayHosts.map((host) => `${host}:${controlPort}`),
      relayPassword: bridgeConfig.relayPassword,
    };
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "text/javascript; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.status(200).send(`window.__CROC_RUNTIME_CONFIG__ = ${JSON.stringify(runtimeConfig)};\n`);
  });

  app.get("/api/relays/status", (_req, res) => {
    const controlPort = bridgeConfig.allowedPorts[0] || "9009";
    res.json({
      publicRelays: bridgeConfig.relayHosts.map((host, index) => ({
        index,
        id: `public-${index}`,
        name: `Croc Public #${index + 1}`,
        host,
        port: controlPort,
        address: `${host}:${controlPort}`,
        kind: "public",
      })),
      localDualRelay: dualRelayHub.getStats(),
      allowedPorts: bridgeConfig.allowedPorts,
    });
  });

  app.get("/api/relays/ping", async (req, res) => {
    const target = String(req.query.target ?? "").trim();
    if (target === "alpha" || target === "beta") {
      const started = performance.now();
      await new Promise((r) => setImmediate(r));
      const rttMs = Math.max(0.4, Math.round((performance.now() - started) * 10) / 10);
      res.json({
        ok: true,
        target,
        host: target === "alpha" ? "local-relay-alpha" : "local-relay-beta",
        rttMs,
      });
      return;
    }

    if (target === "public") {
      const indexParam = String(req.query.index ?? "");
      const defaultPort = bridgeConfig.allowedPorts[0] || "9009";
      const resolved = resolveAllowedTarget(bridgeConfig, indexParam, defaultPort);
      if (!resolved.ok) {
        res.status(resolved.statusCode).json({ ok: false, error: resolved.error });
        return;
      }
      const probe = await measureTcpRtt(resolved.host, resolved.port, 2500);
      res.json({
        ok: probe.ok,
        target: "public",
        index: resolved.relayIndex,
        host: resolved.host,
        port: resolved.port,
        rttMs: probe.rttMs,
        error: probe.error,
      });
      return;
    }

    res.status(400).json({ ok: false, error: "Unsupported ping target" });
  });

  const httpServer = http.createServer(app);
  const wssBridge = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 * 1024 });
  const wssDual = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 * 1024 });

  httpServer.on("upgrade", (req, socket, head) => {
    let parsed: URL;
    try {
      parsed = new URL(req.url || "/", "http://localhost");
    } catch {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      socket.destroy();
      return;
    }

    if (parsed.pathname === "/ws") {
      const target = resolveAllowedTarget(
        bridgeConfig,
        parsed.searchParams.get("relay"),
        parsed.searchParams.get("port"),
      );
      if (!target.ok) {
        const statusText = target.statusCode === 403 ? "Forbidden" : "Bad Request";
        socket.write(`HTTP/1.1 ${target.statusCode} ${statusText}\r\nContent-Type: text/plain\r\n\r\n${target.error}`);
        socket.destroy();
        return;
      }

      const upstream = net.createConnection({ host: target.host, port: target.port });
      let upgraded = false;

      upstream.setTimeout(10_000, () => {
        if (!upgraded) {
          upstream.destroy();
          socket.write("HTTP/1.1 504 Gateway Timeout\r\n\r\nRelay connection timed out");
          socket.destroy();
        }
      });

      upstream.once("error", () => {
        if (!upgraded) {
          socket.write("HTTP/1.1 502 Bad Gateway\r\n\r\nRelay is unavailable");
          socket.destroy();
        }
      });

      upstream.once("connect", () => {
        upstream.setTimeout(0);
        upgraded = true;
        wssBridge.handleUpgrade(req, socket, head, (ws: WebSocket) => {
          ws.on("message", (data) => {
            if (!upstream.destroyed) {
              if (Buffer.isBuffer(data)) {
                upstream.write(data);
              } else if (data instanceof ArrayBuffer) {
                upstream.write(Buffer.from(data));
              } else if (Array.isArray(data)) {
                upstream.write(Buffer.concat(data));
              } else {
                upstream.write(Buffer.from(String(data)));
              }
            }
          });

          upstream.on("data", (chunk) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(chunk, { binary: true });
            }
          });

          const teardown = () => {
            if (!upstream.destroyed) upstream.destroy();
            if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
              ws.close();
            }
          };

          ws.on("close", teardown);
          ws.on("error", teardown);
          upstream.on("close", teardown);
          upstream.on("error", teardown);
        });
      });
      return;
    }

    if (parsed.pathname === "/ws-dual") {
      const channel = parsed.searchParams.get("channel");
      const room = parsed.searchParams.get("room");
      const role = parsed.searchParams.get("role") === "sender" ? "sender" : "receiver";

      if (!isValidLocalChannel(channel) || !isValidRoomId(room)) {
        socket.write("HTTP/1.1 400 Bad Request\r\nContent-Type: text/plain\r\n\r\nInvalid channel or room");
        socket.destroy();
        return;
      }

      wssDual.handleUpgrade(req, socket, head, (ws: WebSocket) => {
        dualRelayHub.join(channel, room, role, ws);
      });
      return;
    }

    socket.destroy();
  });

  const useViteDev = options.useViteDev ?? process.env.NODE_ENV !== "production";
  let viteServer: { close: () => Promise<void> } | undefined;

  if (useViteDev) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      root: __dirname,
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    viteServer = vite;
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  return {
    app,
    httpServer,
    dualRelayHub,
    async listen(port = options.port ?? Number(process.env.PORT || 3000), host = options.host ?? "0.0.0.0") {
      await new Promise<void>((resolve) => {
        httpServer.listen(port, host, () => resolve());
      });
      const address = httpServer.address();
      const boundPort = typeof address === "object" && address ? address.port : port;
      return { port: boundPort, host };
    },
    async close() {
      wssBridge.close();
      wssDual.close();
      if (viteServer) await viteServer.close();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    },
  };
}

const isEntrypoint =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  const port = Number(process.env.PORT || 3000);
  createCrocFlowServer({ port, host: "0.0.0.0" })
    .then((server) => server.listen(port, "0.0.0.0"))
    .then(({ port: boundPort }) => {
      console.log(`CrocFlow unified server running at http://0.0.0.0:${boundPort}`);
    })
    .catch((err) => {
      console.error("Failed to start CrocFlow server:", err);
      process.exit(1);
    });
}
