import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFolderManifest,
  computeResumePlan,
  makeChunkCacheKey,
  sanitizeRelativePath,
} from "./manifest.ts";

test("sanitizeRelativePath accepts safe nested folder paths and rejects traversal/absolute/control paths", () => {
  assert.equal(sanitizeRelativePath("project/src/main.ts"), "project/src/main.ts");
  assert.equal(sanitizeRelativePath("docs\\week1\\report.pdf"), "docs/week1/report.pdf");
  assert.equal(sanitizeRelativePath("./notes/readme.md"), "notes/readme.md");

  assert.throws(() => sanitizeRelativePath("../secret.txt"), /path traversal/i);
  assert.throws(() => sanitizeRelativePath("docs/../../etc/passwd"), /path traversal/i);
  assert.throws(() => sanitizeRelativePath("/etc/passwd"), /tuyệt đối/i);
  assert.throws(() => sanitizeRelativePath("C:/Windows/win.ini"), /tuyệt đối/i);
  assert.throws(() => sanitizeRelativePath("bad\x00name.txt"), /ký tự điều khiển/i);
});

test("buildFolderManifest splits files into indexed SHA-256 chunks accurately", async () => {
  const fileA = new Uint8Array(5000).fill(65); // 'A'
  const fileB = new Uint8Array(1200).fill(66); // 'B'

  const manifest = await buildFolderManifest(
    [
      { relativePath: "lab/fileA.bin", name: "fileA.bin", size: fileA.byteLength, bytes: fileA },
      { relativePath: "lab/sub/fileB.bin", name: "fileB.bin", size: fileB.byteLength, bytes: fileB },
    ],
    2048,
  );

  assert.equal(manifest.totalFiles, 2);
  assert.equal(manifest.totalBytes, 6200);
  // fileA = ceil(5000/2048) = 3 chunks; fileB = ceil(1200/2048) = 1 chunk => 4 chunks total
  assert.equal(manifest.totalChunks, 4);
  assert.equal(manifest.chunks[0].sha256.length, 64);
  assert.equal(manifest.chunks[2].size, 5000 - 4096);
});

test("computeResumePlan skips already verified chunks and detects newly added files after disconnect", async () => {
  const chunkSize = 2048;
  const file1 = new Uint8Array(4096).fill(1);
  const file2 = new Uint8Array(3000).fill(2);

  // Initial folder manifest before network drop
  const initialManifest = await buildFolderManifest(
    [
      { relativePath: "course/part1.dat", name: "part1.dat", size: file1.byteLength, bytes: file1 },
      { relativePath: "course/part2.dat", name: "part2.dat", size: file2.byteLength, bytes: file2 },
    ],
    chunkSize,
  );

  // Receiver already verified all chunks of part1.dat and chunk 0 of part2.dat before disconnect
  const cachedKeys = new Set<string>([
    makeChunkCacheKey(initialManifest.chunks[0].filePath, initialManifest.chunks[0].chunkIndexInFile, initialManifest.chunks[0].sha256),
    makeChunkCacheKey(initialManifest.chunks[1].filePath, initialManifest.chunks[1].chunkIndexInFile, initialManifest.chunks[1].sha256),
    makeChunkCacheKey(initialManifest.chunks[2].filePath, initialManifest.chunks[2].chunkIndexInFile, initialManifest.chunks[2].sha256),
  ]);
  const knownFiles = new Set(initialManifest.files.map((f) => f.relativePath));

  // Lecturer adds a brand-new file into the folder while disconnected!
  const addedFile = new Uint8Array(2500).fill(9);
  const updatedManifest = await buildFolderManifest(
    [
      { relativePath: "course/part1.dat", name: "part1.dat", size: file1.byteLength, bytes: file1 },
      { relativePath: "course/part2.dat", name: "part2.dat", size: file2.byteLength, bytes: file2 },
      { relativePath: "course/extra-from-lecturer.txt", name: "extra-from-lecturer.txt", size: addedFile.byteLength, bytes: addedFile },
    ],
    chunkSize,
  );

  const plan = computeResumePlan(updatedManifest, cachedKeys, knownFiles);

  assert.equal(plan.skippedChunks.length, 3);
  // Missing: chunk 1 of part2.dat + 2 chunks of extra-from-lecturer.txt = 3 chunks
  assert.equal(plan.missingChunks.length, 3);
  assert.deepEqual(plan.newFilePaths, ["course/extra-from-lecturer.txt"]);
  assert.equal(plan.bytesSkipped, 4096 + 2048);
  assert.equal(plan.bytesRemaining, (3000 - 2048) + 2500);
});
