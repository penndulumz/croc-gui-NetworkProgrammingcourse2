export interface FileProgress {
  name: string;
  size: number;
  transferred: number;
  done: boolean;
}

export interface MetricsSnapshot {
  speedBps: number;
  etaSeconds: number | null;
  isStalled: boolean;
}

export interface RollingMetricsOptions {
  windowDurationMs?: number;
  stallThresholdMs?: number;
  now?: () => number;
}

interface MetricSample {
  time: number;
  bytes: number;
}

/**
 * Real-time transfer throughput and ETA tracker using a sliding time window (default 3000ms).
 */
export class RollingMetricsTracker {
  private windowDurationMs: number;
  private stallThresholdMs: number;
  private now: () => number;

  private samples: MetricSample[] = [];
  private lastTransferredBytes = 0;
  private lastTotalBytes = 0;
  private lastProgressTime = 0;
  private isStalledState = false;

  constructor(options?: RollingMetricsOptions) {
    this.windowDurationMs = options?.windowDurationMs ?? 3000;
    this.stallThresholdMs = options?.stallThresholdMs ?? 2000;
    this.now =
      options?.now ??
      (() =>
        typeof performance !== "undefined" && performance.now
          ? performance.now()
          : Date.now());
    this.reset();
  }

  reset(): void {
    this.samples = [];
    this.lastTransferredBytes = 0;
    this.lastTotalBytes = 0;
    this.lastProgressTime = this.now();
    this.isStalledState = false;
  }

  update(transferredBytes: number, totalBytes: number): MetricsSnapshot {
    const currentTime = this.now();
    this.lastTotalBytes = totalBytes;

    if (transferredBytes > this.lastTransferredBytes) {
      this.lastProgressTime = currentTime;
      this.lastTransferredBytes = transferredBytes;
      this.isStalledState = false;
    } else if (transferredBytes < this.lastTransferredBytes) {
      // Transfer was reset or restarted
      this.lastTransferredBytes = transferredBytes;
      this.lastProgressTime = currentTime;
      this.samples = [];
      this.isStalledState = false;
    }

    // Record sample
    this.samples.push({ time: currentTime, bytes: transferredBytes });

    // Discard samples older than the sliding window duration
    const cutoff = currentTime - this.windowDurationMs;
    this.samples = this.samples.filter((s) => s.time >= cutoff);

    // Calculate throughput over the sliding window
    let speedBps = 0;
    if (this.samples.length >= 2) {
      const oldest = this.samples[0];
      const newest = this.samples[this.samples.length - 1];
      const deltaSec = (newest.time - oldest.time) / 1000;
      const deltaBytes = newest.bytes - oldest.bytes;
      if (deltaSec > 0 && deltaBytes > 0) {
        speedBps = deltaBytes / deltaSec;
      }
    }

    const isComplete = totalBytes > 0 && transferredBytes >= totalBytes;

    // Detect stalls
    if (isComplete) {
      this.isStalledState = false;
    } else if (currentTime - this.lastProgressTime >= this.stallThresholdMs) {
      this.isStalledState = true;
      speedBps = 0;
    }

    // Calculate ETA
    let etaSeconds: number | null = null;
    if (isComplete) {
      etaSeconds = 0;
    } else if (this.isStalledState || speedBps <= 0) {
      etaSeconds = null;
    } else {
      const remainingBytes = Math.max(0, totalBytes - transferredBytes);
      etaSeconds = Math.round(remainingBytes / speedBps);
    }

    return {
      speedBps,
      etaSeconds,
      isStalled: this.isStalledState,
    };
  }

  getSnapshot(): MetricsSnapshot {
    return this.update(this.lastTransferredBytes, this.lastTotalBytes);
  }

  getSpeedBps(): number {
    return this.getSnapshot().speedBps;
  }

  getEtaSeconds(): number | null {
    return this.getSnapshot().etaSeconds;
  }

  isStalled(): boolean {
    return this.isStalledState;
  }
}

/**
 * Formats a speed in bytes per second into human-readable units (e.g. "2.4 MB/s", "350 KB/s").
 */
export function formatSpeed(speedBps: number): string {
  if (!Number.isFinite(speedBps) || speedBps <= 0) return "0 B/s";
  const units = ["B/s", "KB/s", "MB/s", "GB/s"];
  let value = speedBps;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  if (unitIndex === 0) {
    return `${Math.round(value)} B/s`;
  }
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  const formatted =
    digits === 0
      ? Math.round(value).toString()
      : value.toFixed(digits).replace(/\.?0+$/, "");
  return `${formatted} ${units[unitIndex]}`;
}

/**
 * Formats an ETA in seconds into a friendly string (e.g. "1m 15s", "45s", "Đang tính..." / "Tạm dừng").
 */
export function formatEta(etaSeconds: number | null, isStalled = false): string {
  if (isStalled) {
    return "Tạm dừng";
  }
  if (etaSeconds === null || !Number.isFinite(etaSeconds) || etaSeconds < 0) {
    return "Đang tính...";
  }
  const totalSeconds = Math.round(etaSeconds);
  if (totalSeconds <= 0) {
    return "0s";
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Computes per-file progress for sequential file transfers (Standard Mode).
 */
export function calculateFileProgress(
  files: Array<{ name: string; size: number }>,
  currentFileIndex: number,
  currentFileBytes: number,
): FileProgress[] {
  return files.map((file, idx) => {
    if (idx < currentFileIndex) {
      return {
        name: file.name,
        size: file.size,
        transferred: file.size,
        done: true,
      };
    }
    if (idx === currentFileIndex) {
      const transferred = Math.min(file.size, currentFileBytes);
      return {
        name: file.name,
        size: file.size,
        transferred,
        done: file.size > 0 ? transferred >= file.size : true,
      };
    }
    return {
      name: file.name,
      size: file.size,
      transferred: 0,
      done: false,
    };
  });
}

/**
 * Computes per-file progress from chunk completion (Enhanced Mode).
 */
export function calculateManifestFileProgress(
  files: Array<{ relativePath?: string; name: string; size: number; fileIndex?: number }>,
  chunks: Array<{ fileIndex: number; size: number; globalIndex: number }>,
  completedChunkIndices: Set<number>,
): FileProgress[] {
  const transferredPerFile = new Array<number>(files.length).fill(0);
  for (const chunk of chunks) {
    if (completedChunkIndices.has(chunk.globalIndex)) {
      if (chunk.fileIndex >= 0 && chunk.fileIndex < files.length) {
        transferredPerFile[chunk.fileIndex] += chunk.size;
      }
    }
  }
  return files.map((file, idx) => {
    const transferred = Math.min(file.size, transferredPerFile[idx] || 0);
    return {
      name: file.relativePath || file.name,
      size: file.size,
      transferred,
      done: file.size > 0 ? transferred >= file.size : true,
    };
  });
}
