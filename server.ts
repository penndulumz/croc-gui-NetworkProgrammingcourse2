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
  LocalDualRelayNode,
} from "./server/local-dual-relay.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Page origins of the Capacitor Android WebView allowed to call the HTTP API cross-origin. */
export const NATIVE_SHELL_ORIGINS: ReadonlySet<string> = new Set([
  "https://localhost",
  "http://localhost",
  "capacitor://localhost",
]);

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
  const dualRelayNode = new LocalDualRelayNode();
  const app = express();

  app.disable("x-powered-by");

  // Narrow CORS for the HTTP API only (/healthz, /api/*), so the Capacitor
  // Android WebView (page origin http(s)://localhost or capacitor://localhost)
  // can reach a Bridge Server on the LAN. WebSocket upgrades (/ws, /ws-dual)
  // bypass Express and keep their own allowlist checks.
  app.use((req, res, next) => {
    if (req.path !== "/healthz" && !req.path.startsWith("/api/")) {
      next();
      return;
    }
    const origin = req.headers.origin;
    if (typeof origin === "string" && NATIVE_SHELL_ORIGINS.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Max-Age", "600");
      if (req.headers["access-control-request-private-network"] === "true") {
        res.setHeader("Access-Control-Allow-Private-Network", "true");
      }
    }
    res.append("Vary", "Origin");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  const buildRuntimeConfig = () => {
    const controlPort = bridgeConfig.allowedPorts[0] || "9009";
    return {
      bridgeURL: "/ws",
      localDualRelayURL: "/ws-dual",
      relayAddresses: bridgeConfig.relayHosts.map((host) => `${host}:${controlPort}`),
      relayPassword: bridgeConfig.relayPassword,
    };
  };

  app.get("/healthz", (_req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.status(200).send("ok\n");
  });

  // JSON twin of /config.js for clients not served by this Bridge Server (Android APK).
  app.get("/api/runtime-config", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json(buildRuntimeConfig());
  });

  app.get("/config.js", (_req, res) => {
    const runtimeConfig = buildRuntimeConfig();
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
      localDualRelay: dualRelayNode.getStats(),
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
        upstream.setKeepAlive(true, 15_000);
        upgraded = true;
        wssBridge.handleUpgrade(req, socket, head, (ws: WebSocket) => {
          const heartbeat = setInterval(() => {
            if (ws.readyState === ws.OPEN) {
              ws.ping();
            }
          }, 20_000);
          heartbeat.unref?.();

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
            clearInterval(heartbeat);
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
        dualRelayNode.join(channel, room, role, ws);
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
    // CROCFLOW_DIST_DIR lets packaged hosts (Electron desktop) point at the
    // built web app explicitly; default stays `dist/` next to this file.
    const distDir = process.env.CROCFLOW_DIST_DIR
      ? path.resolve(process.env.CROCFLOW_DIST_DIR)
      : path.join(__dirname, "dist");
    app.use(express.static(distDir));
    // SPA fallback as terminal middleware rather than a wildcard GET route: a bare
    // "*" path throws under Express 5 (path-to-regexp v8), this works on 4 and 5.
    app.use((req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") {
        next();
        return;
      }
      // `root` keeps send's dotfile guard off the install path itself (e.g.
      // AppImage mounts under /tmp/.mount_*), which Express 5 would 404.
      res.sendFile("index.html", { root: distDir });
    });
  }

  return {
    app,
    httpServer,
    dualRelayNode,
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
