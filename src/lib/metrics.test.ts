import test from "node:test";
import assert from "node:assert/strict";
import {
  RollingMetricsTracker,
  formatSpeed,
  formatEta,
  calculateFileProgress,
  calculateManifestFileProgress,
} from "./metrics.ts";

test("formatSpeed formats bytes per second into clean human units", () => {
  assert.equal(formatSpeed(0), "0 B/s");
  assert.equal(formatSpeed(-100), "0 B/s");
  assert.equal(formatSpeed(500), "500 B/s");
  assert.equal(formatSpeed(1024), "1 KB/s");
  assert.equal(formatSpeed(350 * 1024), "350 KB/s");
  assert.equal(formatSpeed(2.4 * 1024 * 1024), "2.4 MB/s");
  assert.equal(formatSpeed(10.5 * 1024 * 1024), "10.5 MB/s");
  assert.equal(formatSpeed(1.25 * 1024 * 1024 * 1024), "1.25 GB/s");
});

test("formatEta formats remaining seconds into natural time expressions", () => {
  assert.equal(formatEta(null), "Đang tính...");
  assert.equal(formatEta(null, false), "Đang tính...");
  assert.equal(formatEta(null, true), "Tạm dừng");
  assert.equal(formatEta(45, true), "Tạm dừng");
  assert.equal(formatEta(0), "0s");
  assert.equal(formatEta(45), "45s");
  assert.equal(formatEta(75), "1m 15s");
  assert.equal(formatEta(120), "2m 0s");
  assert.equal(formatEta(3600), "1h 0m 0s");
  assert.equal(formatEta(3675), "1h 1m 15s");
});

test("RollingMetricsTracker calculates speed accurately over time", () => {
  let currentTime = 1000;
  const tracker = new RollingMetricsTracker({
    windowDurationMs: 3000,
    stallThresholdMs: 2000,
    now: () => currentTime,
  });

  // t = 1000: initial sample
  const snap1 = tracker.update(0, 10000);
  assert.equal(snap1.speedBps, 0);
  assert.equal(snap1.etaSeconds, null);
  assert.equal(snap1.isStalled, false);

  // t = 2000: 1000 bytes in 1 second
  currentTime = 2000;
  const snap2 = tracker.update(1000, 10000);
  assert.equal(snap2.speedBps, 1000);
  // remaining: 9000 bytes / 1000 Bps = 9s
  assert.equal(snap2.etaSeconds, 9);
  assert.equal(snap2.isStalled, false);

  // t = 3000: transferred 3000 bytes total (2000 bytes in 2 seconds)
  currentTime = 3000;
  const snap3 = tracker.update(3000, 10000);
  // In window [1000, 3000]: delta = 3000 bytes over 2s -> 1500 B/s
  assert.equal(snap3.speedBps, 1500);
  // remaining: 7000 / 1500 ~= 5s
  assert.equal(snap3.etaSeconds, 5);
  assert.equal(snap3.isStalled, false);
});

test("RollingMetricsTracker discards samples older than window duration", () => {
  let currentTime = 1000;
  const tracker = new RollingMetricsTracker({
    windowDurationMs: 3000,
    stallThresholdMs: 2500,
    now: () => currentTime,
  });

  // t = 1000: 0 bytes
  tracker.update(0, 10000);

  // t = 2000: 1000 bytes
  currentTime = 2000;
  tracker.update(1000, 10000);

  // t = 3000: 3000 bytes
  currentTime = 3000;
  tracker.update(3000, 10000);

  // t = 5000: 6000 bytes
  // Cutoff is 5000 - 3000 = 2000.
  // Sample at t=1000 (0 bytes) is discarded!
  // Remaining samples: t=2000 (1000 bytes), t=3000 (3000 bytes), t=5000 (6000 bytes).
  // Window duration = 5000 - 2000 = 3000ms = 3s.
  // Delta bytes = 6000 - 1000 = 5000 bytes.
  // Speed = 5000 / 3 = 1666.67 B/s.
  currentTime = 5000;
  const snap = tracker.update(6000, 10000);
  assert.equal(Math.round(snap.speedBps), 1667);
  // remaining = 4000 / 1666.67 = 2.4s -> rounded to 2s
  assert.equal(snap.etaSeconds, 2);
});

test("RollingMetricsTracker handles zero-speed stalls gracefully", () => {
  let currentTime = 1000;
  const tracker = new RollingMetricsTracker({
    windowDurationMs: 3000,
    stallThresholdMs: 2000,
    now: () => currentTime,
  });

  tracker.update(0, 10000);
  currentTime = 2000;
  const snapActive = tracker.update(2000, 10000);
  assert.equal(snapActive.isStalled, false);
  assert.equal(snapActive.speedBps, 2000);

  // Progress freezes for 1000ms (< stallThreshold 2000ms)
  currentTime = 3000;
  const snapPausing = tracker.update(2000, 10000);
  assert.equal(snapPausing.isStalled, false);

  // Progress freezes for 2500ms since last progress (> stallThreshold 2000ms)
  currentTime = 4500;
  const snapStalled = tracker.update(2000, 10000);
  assert.equal(snapStalled.isStalled, true);
  assert.equal(snapStalled.speedBps, 0);
  assert.equal(snapStalled.etaSeconds, null);
  assert.equal(formatEta(snapStalled.etaSeconds, snapStalled.isStalled), "Tạm dừng");

  // Transfer resumes
  currentTime = 5000;
  const snapResumed = tracker.update(4000, 10000);
  assert.equal(snapResumed.isStalled, false);
  assert.equal(snapResumed.speedBps > 0, true);
});

test("RollingMetricsTracker handles transfer completion", () => {
  let currentTime = 1000;
  const tracker = new RollingMetricsTracker({ now: () => currentTime });
  tracker.update(0, 5000);

  currentTime = 2000;
  const snap = tracker.update(5000, 5000);
  assert.equal(snap.isStalled, false);
  assert.equal(snap.etaSeconds, 0);
  assert.equal(formatEta(snap.etaSeconds, snap.isStalled), "0s");
});

test("calculateFileProgress derives accurate progress for sequential files", () => {
  const files = [
    { name: "file1.txt", size: 1000 },
    { name: "file2.jpg", size: 3000 },
    { name: "file3.pdf", size: 2000 },
  ];

  // Currently transferring file 1 (index 1), 1500 bytes done
  const progress = calculateFileProgress(files, 1, 1500);
  assert.equal(progress.length, 3);

  // File 0 must be done
  assert.equal(progress[0].name, "file1.txt");
  assert.equal(progress[0].transferred, 1000);
  assert.equal(progress[0].done, true);

  // File 1 is partially done
  assert.equal(progress[1].name, "file2.jpg");
  assert.equal(progress[1].transferred, 1500);
  assert.equal(progress[1].done, false);

  // File 2 is not started
  assert.equal(progress[2].name, "file3.pdf");
  assert.equal(progress[2].transferred, 0);
  assert.equal(progress[2].done, false);
});

test("calculateManifestFileProgress derives accurate progress from delivered chunks", () => {
  const files = [
    { relativePath: "docs/readme.txt", name: "readme.txt", size: 200 },
    { relativePath: "docs/spec.pdf", name: "spec.pdf", size: 1000 },
  ];
  const chunks = [
    { globalIndex: 0, fileIndex: 0, size: 200 },
    { globalIndex: 1, fileIndex: 1, size: 500 },
    { globalIndex: 2, fileIndex: 1, size: 500 },
  ];

  // Chunks 0 and 1 are delivered, chunk 2 is pending
  const completed = new Set([0, 1]);
  const progress = calculateManifestFileProgress(files, chunks, completed);

  assert.equal(progress.length, 2);
  assert.equal(progress[0].name, "docs/readme.txt");
  assert.equal(progress[0].transferred, 200);
  assert.equal(progress[0].done, true);

  assert.equal(progress[1].name, "docs/spec.pdf");
  assert.equal(progress[1].transferred, 500);
  assert.equal(progress[1].done, false);
});
