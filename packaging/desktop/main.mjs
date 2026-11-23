import { app, BrowserWindow, dialog, shell } from "electron";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// In a packaged build main.mjs lives inside app.asar; server.mjs and dist/ are
// listed in `asarUnpack`, so the embedded server runs from real files on disk.
const appDir = app.isPackaged
  ? __dirname.replace(/app\.asar(?=$|[\\/])/, "app.asar.unpacked")
  : __dirname;
const serverEntry = path.join(appDir, "server.mjs");
const distDir = path.join(appDir, "dist");

let bridgeProcess = null;
let bridgeReady = null;
let mainWindow = null;
let quitting = false;

function ensurePortFree(port) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", (err) => {
      if (err && err.code === "EADDRINUSE") {
        reject(
          new Error(
            `Port ${port} is already in use (another CrocFlow instance or app?).\n` +
              "Close it or start CrocFlow with a different CROCFLOW_PORT.",
          ),
        );
      } else {
        reject(err);
      }
    });
    probe.once("listening", () => probe.close(() => resolve()));
    probe.listen(port, "0.0.0.0");
  });
}

function waitForHealth(port, isAborted, timeoutMs = 15000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const check = async () => {
      if (isAborted()) return;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/healthz`);
        if (res.ok) {
          resolve();
          return;
        }
      } catch {
        // Server still starting
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`CrocFlow Embedded Bridge Server did not become healthy within ${timeoutMs / 1000}s`));
        return;
      }
      setTimeout(check, 250);
    };
    void check();
  });
}

function stopEmbeddedBridge() {
  if (bridgeProcess && bridgeProcess.exitCode === null && !bridgeProcess.killed) {
    bridgeProcess.kill();
  }
  bridgeProcess = null;
  bridgeReady = null;
}

async function startEmbeddedBridge(port) {
  if (!fs.existsSync(serverEntry)) {
    throw new Error(`Embedded server bundle not found at ${serverEntry}.\nRun \`npm run bundle:server\` in packaging/desktop.`);
  }
  await ensurePortFree(port);

  const child = spawn(process.execPath, [serverEntry], {
    cwd: appDir,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      CROCFLOW_DIST_DIR: distDir,
      ELECTRON_RUN_AS_NODE: "1",
    },
    stdio: ["ignore", "inherit", "pipe"],
    windowsHide: true,
  });
  bridgeProcess = child;

  // Keep the tail of stderr for the error dialog, while still forwarding it.
  let stderrTail = "";
  child.stderr.on("data", (chunk) => {
    process.stderr.write(chunk);
    stderrTail = (stderrTail + chunk.toString()).slice(-2000);
  });

  let exited = false;
  const exitedEarly = new Promise((_, reject) => {
    child.once("error", (err) => {
      exited = true;
      reject(new Error(`Failed to launch Embedded Bridge Server: ${err.message}`));
    });
    child.once("exit", (code, signal) => {
      exited = true;
      reject(
        new Error(
          `Embedded Bridge Server exited during startup (code ${code ?? "null"}, signal ${signal ?? "none"}).` +
            (stderrTail ? `\n\n${stderrTail.trim()}` : ""),
        ),
      );
    });
  });

  try {
    await Promise.race([waitForHealth(port, () => exited), exitedEarly]);
  } catch (err) {
    stopEmbeddedBridge();
    throw err;
  }

  // After a successful start, report an unexpected crash instead of leaving a dead window.
  exitedEarly.catch(() => {});
  child.once("exit", (code, signal) => {
    if (bridgeProcess === child) {
      bridgeProcess = null;
      bridgeReady = null;
    }
    if (!quitting) {
      dialog.showErrorBox(
        "CrocFlow",
        `The Embedded Bridge Server stopped unexpectedly (code ${code ?? "null"}, signal ${signal ?? "none"}).` +
          (stderrTail ? `\n\n${stderrTail.trim()}` : ""),
      );
      app.quit();
    }
  });
}

function ensureEmbeddedBridge(port) {
  if (!bridgeReady) {
    bridgeReady = startEmbeddedBridge(port);
  }
  return bridgeReady;
}

async function createWindow() {
  const port = Number(process.env.CROCFLOW_PORT || "3000");
  await ensureEmbeddedBridge(port);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 390,
    minHeight: 680,
    title: "CrocFlow — Truyền tệp mã hóa E2E",
    webPreferences: {
      preload: path.resolve(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  await mainWindow.loadURL(`http://127.0.0.1:${port}`);
}

function failStartup(err) {
  console.error("CrocFlow failed to start:", err);
  quitting = true;
  stopEmbeddedBridge();
  dialog.showErrorBox("CrocFlow failed to start", err instanceof Error ? err.message : String(err));
  app.quit();
}

app.whenReady().then(() => {
  createWindow().catch(failStartup);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch(failStartup);
    }
  });
});

app.on("window-all-closed", () => {
  // On macOS the app (and its bridge) stays alive until Cmd+Q; elsewhere quit.
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  quitting = true;
});

app.on("will-quit", () => {
  quitting = true;
  stopEmbeddedBridge();
});

process.on("exit", () => {
  stopEmbeddedBridge();
});
