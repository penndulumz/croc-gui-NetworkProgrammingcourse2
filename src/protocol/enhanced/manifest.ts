export interface ManifestChunkDescriptor {
  globalIndex: number;
  fileIndex: number;
  filePath: string;
  chunkIndexInFile: number;
  offset: number;
  size: number;
  sha256: string;
}

export interface ManifestFileEntry {
  fileIndex: number;
  relativePath: string;
  name: string;
  size: number;
  mimeType: string;
  chunkCount: number;
  fileSha256: string;
}

export interface FolderManifest {
  version: 1;
  manifestId: string;
  createdAt: number;
  chunkSize: number;
  totalFiles: number;
  totalBytes: number;
  totalChunks: number;
  files: ManifestFileEntry[];
  chunks: ManifestChunkDescriptor[];
}

export interface ManifestInputFile {
  relativePath: string;
  name: string;
  size: number;
  mimeType?: string;
  bytes: Uint8Array;
}

export interface ResumePlan {
  manifestId: string;
  totalChunks: number;
  skippedChunks: ManifestChunkDescriptor[];
  missingChunks: ManifestChunkDescriptor[];
  newFilePaths: string[];
  bytesSkipped: number;
  bytesRemaining: number;
}

export function sanitizeRelativePath(rawPath: string): string {
  const normalized = rawPath.replace(/\\/g, "/").trim();
  if (!normalized) {
    throw new Error("Đường dẫn tệp không được để trống");
  }
  if (/[\x00-\x1f\x7f]/.test(normalized)) {
    throw new Error(`Đường dẫn chứa ký tự điều khiển không hợp lệ: ${rawPath}`);
  }
  // Reject absolute paths or Windows drive prefixes
  if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) {
    throw new Error(`Không cho phép đường dẫn tuyệt đối: ${rawPath}`);
  }

  const rawSegments = normalized.split("/").filter((s) => s.length > 0 && s !== ".");
  if (rawSegments.length === 0) {
    throw new Error(`Đường dẫn không hợp lệ: ${rawPath}`);
  }

  for (const seg of rawSegments) {
    if (seg === "..") {
      throw new Error(`Phát hiện đường dẫn leo thư mục (path traversal): ${rawPath}`);
    }
  }

  return rawSegments.join("/");
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function makeChunkCacheKey(filePath: string, chunkIndexInFile: number, sha256: string): string {
  return `${filePath}::${chunkIndexInFile}::${sha256}`;
}

export async function buildFolderManifest(
  files: ManifestInputFile[],
  chunkSize = 64 * 1024,
  manifestId?: string,
): Promise<FolderManifest> {
  if (files.length === 0) {
    throw new Error("Cần ít nhất một tệp để tạo Folder Manifest");
  }
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 1024) {
    throw new Error("Kích thước Chunk tối thiểu là 1024 bytes");
  }

  const seenPaths = new Set<string>();
  const fileEntries: ManifestFileEntry[] = [];
  const chunks: ManifestChunkDescriptor[] = [];
  let totalBytes = 0;
  let globalIndex = 0;

  for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
    const input = files[fileIndex];
    const safePath = sanitizeRelativePath(input.relativePath || input.name);
    if (seenPaths.has(safePath)) {
      throw new Error(`Trùng đường dẫn tệp trong thư mục: ${safePath}`);
    }
    seenPaths.add(safePath);

    const fileHash = await sha256Hex(input.bytes);
    const chunkCount = input.bytes.byteLength === 0 ? 1 : Math.ceil(input.bytes.byteLength / chunkSize);

    fileEntries.push({
      fileIndex,
      relativePath: safePath,
      name: input.name,
      size: input.bytes.byteLength,
      mimeType: input.mimeType || "application/octet-stream",
      chunkCount,
      fileSha256: fileHash,
    });
    totalBytes += input.bytes.byteLength;

    for (let c = 0; c < chunkCount; c += 1) {
      const offset = c * chunkSize;
      const slice = input.bytes.subarray(offset, Math.min(offset + chunkSize, input.bytes.byteLength));
      const chunkHash = await sha256Hex(slice);
      chunks.push({
        globalIndex,
        fileIndex,
        filePath: safePath,
        chunkIndexInFile: c,
        offset,
        size: slice.byteLength,
        sha256: chunkHash,
      });
      globalIndex += 1;
    }
  }

  const idSeed = fileEntries.map((f) => `${f.relativePath}:${f.fileSha256}`).join("|");
  const computedId = manifestId ?? (await sha256Hex(new TextEncoder().encode(idSeed))).slice(0, 16);

  return {
    version: 1,
    manifestId: computedId,
    createdAt: Date.now(),
    chunkSize,
    totalFiles: fileEntries.length,
    totalBytes,
    totalChunks: chunks.length,
    files: fileEntries,
    chunks,
  };
}

/**
 * Compares a freshly received FolderManifest against already verified chunks
 * persisted in the local Resume Cache (including detecting brand-new files
 * added to a folder after a network disconnect).
 */
export function computeResumePlan(
  manifest: FolderManifest,
  verifiedChunkKeys: ReadonlySet<string>,
  previouslyKnownFiles?: ReadonlySet<string>,
): ResumePlan {
  const skippedChunks: ManifestChunkDescriptor[] = [];
  const missingChunks: ManifestChunkDescriptor[] = [];
  let bytesSkipped = 0;
  let bytesRemaining = 0;

  for (const chunk of manifest.chunks) {
    const key = makeChunkCacheKey(chunk.filePath, chunk.chunkIndexInFile, chunk.sha256);
    if (verifiedChunkKeys.has(key)) {
      skippedChunks.push(chunk);
      bytesSkipped += chunk.size;
    } else {
      missingChunks.push(chunk);
      bytesRemaining += chunk.size;
    }
  }

  const newFilePaths = manifest.files
    .map((f) => f.relativePath)
    .filter((filePath) => {
      if (previouslyKnownFiles && previouslyKnownFiles.size > 0) {
        return !previouslyKnownFiles.has(filePath);
      }
      // If no previous file list was provided, treat a file with 0 cached chunks as new
      return !skippedChunks.some((c) => c.filePath === filePath);
    });

  return {
    manifestId: manifest.manifestId,
    totalChunks: manifest.chunks.length,
    skippedChunks,
    missingChunks,
    newFilePaths,
    bytesSkipped,
    bytesRemaining,
  };
}
