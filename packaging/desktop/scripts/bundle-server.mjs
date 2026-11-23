// Bundles the repo-root `server.ts` (Embedded Bridge + Local Dual Relay) into a
// single plain-JS ESM file `packaging/desktop/server.mjs` so Electron can run it
// with ELECTRON_RUN_AS_NODE and no TypeScript loader (tsx) at runtime.
//
// Requires the repo root dependencies to be installed (`npm ci` at repo root):
// esbuild resolves `express`/`ws` from the root node_modules next to server.ts,
// which keeps the bundled versions identical to the web app's lockfile.
//
// Also stages the web build: if `<repo>/dist/index.html` exists it is copied to
// `packaging/desktop/dist`; otherwise an existing `packaging/desktop/dist` is
// used (CI downloads the PWA artifact straight there).
import { build } from "esbuild";
import { cp, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(desktopDir, "..", "..");
const outfile = path.join(desktopDir, "server.mjs");

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

await build({
  entryPoints: [path.join(repoRoot, "server.ts")],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  // Electron 35 ships Node 22; node20 keeps the output conservative.
  target: "node20",
  // `vite` is only imported dynamically in dev mode (NODE_ENV !== "production"),
  // never in the desktop build. bufferutil/utf-8-validate are optional `ws`
  // accelerators loaded inside try/catch.
  external: ["vite", "bufferutil", "utf-8-validate"],
  // Bundled CommonJS deps (express) call require() for Node built-ins; give the
  // ESM bundle a real require so esbuild's shim does not throw.
  banner: {
    js: "import { createRequire as __crocflowCreateRequire } from 'node:module';\nconst require = __crocflowCreateRequire(import.meta.url);",
  },
  legalComments: "none",
  logLevel: "info",
});

const rootDist = path.join(repoRoot, "dist");
const desktopDist = path.join(desktopDir, "dist");
if (await exists(path.join(rootDist, "index.html"))) {
  await rm(desktopDist, { recursive: true, force: true });
  await cp(rootDist, desktopDist, { recursive: true });
  console.log(`Staged web build: ${rootDist} -> ${desktopDist}`);
} else if (await exists(path.join(desktopDist, "index.html"))) {
  console.log(`Using existing web build in ${desktopDist}`);
} else {
  console.error(
    "No web build found. Run `npm run build` at the repo root (or place the PWA dist in packaging/desktop/dist).",
  );
  process.exit(1);
}
