import { protocolEngine } from "./engine";
import { hashSHA256Blob } from "./sha256";

export type FileHashAlgorithm = "xxhash" | "sha256";
export type FileHashProvider = (file: File) => Promise<Uint8Array>;

type HashOperation = {
  controller: AbortController;
  promise: Promise<Uint8Array>;
};

type HashFile = (
  file: File,
  algorithm: FileHashAlgorithm,
  signal?: AbortSignal,
) => Promise<Uint8Array>;

function abortError() {
  return new DOMException("Transfer cancelled", "AbortError");
}

function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw abortError();
}

export async function hashFileContents(
  file: Blob,
  algorithm: FileHashAlgorithm,
  signal?: AbortSignal,
) {
  checkAbort(signal);
  if (algorithm === "sha256") return hashSHA256Blob(file, signal);
  const engine = protocolEngine();
  const handle = await engine.hashInit(signal);
  const reader = file.stream().getReader();
  let finalized = false;
  try {
    for (;;) {
      checkAbort(signal);
      const { done, value } = await reader.read();
      checkAbort(signal);
      if (done) break;
      await engine.hashUpdate(handle, value);
    }
    finalized = true;
    return await engine.hashFinal(handle);
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
    if (!finalized) {
      await engine.hashRelease(handle).catch(() => undefined);
    }
  }
}

export function waitForHash(hash: Promise<Uint8Array>, signal?: AbortSignal) {
  checkAbort(signal);
  if (!signal) return hash;
  return new Promise<Uint8Array>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener("abort", onAbort, { once: true });
    void hash.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", onAbort);
    });
  });
}

export class FileHashCache {
  private operations = new Map<File, Map<FileHashAlgorithm, HashOperation>>();
  private tails = new Map<FileHashAlgorithm, Promise<void>>();

  constructor(private hashFile: HashFile = hashFileContents) {}

  hash(file: File, algorithm: FileHashAlgorithm) {
    let algorithms = this.operations.get(file);
    if (!algorithms) {
      algorithms = new Map();
      this.operations.set(file, algorithms);
    }
    const existing = algorithms.get(algorithm);
    if (existing) return existing.promise;

    const controller = new AbortController();
    const previous = this.tails.get(algorithm) ?? Promise.resolve();
    const promise = previous.then(() => {
      checkAbort(controller.signal);
      return this.hashFile(file, algorithm, controller.signal);
    });
    this.tails.set(
      algorithm,
      promise.then(
        () => undefined,
        () => undefined,
      ),
    );
    const hashOp: HashOperation = { controller, promise };
    algorithms.set(algorithm, hashOp);
    void promise.catch(() => {
      const current = this.operations.get(file);
      if (current?.get(algorithm) !== hashOp) return;
      current.delete(algorithm);
      if (current.size === 0) this.operations.delete(file);
    });
    return promise;
  }

  prime(files: File[], algorithm: FileHashAlgorithm) {
    for (const file of files) this.hash(file, algorithm);
  }

  retain(files: File[]) {
    const retained = new Set(files);
    for (const [file, algorithms] of this.operations) {
      if (retained.has(file)) continue;
      for (const hashOp of algorithms.values()) hashOp.controller.abort();
      this.operations.delete(file);
    }
  }

  clear() {
    this.retain([]);
  }
}
