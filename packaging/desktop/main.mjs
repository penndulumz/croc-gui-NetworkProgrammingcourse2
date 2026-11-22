import { app, BrowserWindow, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let bridgeProcess = null;
let mainWindow = null;

function waitForHealth(port, timeoutMs = 15000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const check = async () => {
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
        reject(new Error("CrocFlow Embedded Bridge Server timed out on startup"));
        return;
      }
      setTimeout(check, 250);
    };
    void check();
  });
}

async function startEmbeddedBridge(port) {
  const serverEntry = path.resolve(__dirname, "server.ts");
  const child = spawn(process.execPath, ["--import", "tsx", serverEntry], {
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      ELECTRON_RUN_AS_NODE: "1",
    },
    stdio: "inherit",
  });
  bridgeProcess = child;
  await waitForHealth(port);
}

async function createWindow() {
  const port = Number(process.env.CROCFLOW_PORT || "3000");
  await startEmbeddedBridge(port);

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

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  await mainWindow.loadURL(`http://127.0.0.1:${port}`);
}

app.whenReady().then(() => {
  void createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (bridgeProcess) {
    bridgeProcess.kill();
    bridgeProcess = null;
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});
