import { sanitizeRelativePath } from "../protocol/enhanced/manifest";

export interface ZipEntry {
  path: string;
  data: Uint8Array;
  lastModified?: Date;
}

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[i] = c >>> 0;
}

/**
 * Calculates standard CRC-32 (ISO 3309 / ITU-T V.42) checksum.
 */
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Converts a Date to MS-DOS 16-bit time format.
 */
export function toDosTime(date: Date): number {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);
  return ((hours << 11) | (minutes << 5) | seconds) & 0xffff;
}

/**
 * Converts a Date to MS-DOS 16-bit date format.
 */
export function toDosDate(date: Date): number {
  const year = Math.max(1980, date.getFullYear()) - 1980;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return ((year << 9) | (month << 5) | day) & 0xffff;
}

export interface PreparedZipEntry {
  safePath: string;
  encodedName: Uint8Array;
  data: Uint8Array;
  crc: number;
  dosTime: number;
  dosDate: number;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

/**
 * Shared binary layout serializer for ZIP archives (PKZip 2.0 format).
 * Writes Local File Headers, file payloads, Central Directory Headers, and EOCD record.
 */
export function serializeZipArchive(
  prepared: PreparedZipEntry[],
  totalSize: number,
  cdSize: number,
  cdOffset: number,
): Uint8Array {
  const archive = new Uint8Array(totalSize);
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);

  // 1. Write Local File Headers + File Data
  for (const file of prepared) {
    const offset = file.localHeaderOffset;
    view.setUint32(offset + 0, 0x04034b50, true); // Local file header signature
    view.setUint16(offset + 4, 20, true);         // Version needed to extract (2.0)
    view.setUint16(offset + 6, 0x0800, true);     // General purpose bit flag (UTF-8 enabled)
    view.setUint16(offset + 8, file.compressionMethod, true); // Compression method
    view.setUint16(offset + 10, file.dosTime, true);
    view.setUint16(offset + 12, file.dosDate, true);
    view.setUint32(offset + 14, file.crc, true);
    view.setUint32(offset + 18, file.compressedSize, true);
    view.setUint32(offset + 22, file.uncompressedSize, true);
    view.setUint16(offset + 26, file.encodedName.length, true);
    view.setUint16(offset + 28, 0, true);         // Extra field length

    // File name
    archive.set(file.encodedName, offset + 30);
    // File data
    archive.set(file.data, offset + 30 + file.encodedName.length);
  }

  // 2. Write Central Directory Headers
  let currentCdOffset = cdOffset;
  for (const file of prepared) {
    view.setUint32(currentCdOffset + 0, 0x02014b50, true); // Central directory header signature
    view.setUint16(currentCdOffset + 4, 0x0014, true);     // Version made by (DOS 2.0)
    view.setUint16(currentCdOffset + 6, 20, true);         // Version needed to extract (2.0)
    view.setUint16(currentCdOffset + 8, 0x0800, true);     // General purpose bit flag (UTF-8 enabled)
    view.setUint16(currentCdOffset + 10, file.compressionMethod, true); // Compression method
    view.setUint16(currentCdOffset + 12, file.dosTime, true);
    view.setUint16(currentCdOffset + 14, file.dosDate, true);
    view.setUint32(currentCdOffset + 16, file.crc, true);
    view.setUint32(currentCdOffset + 20, file.compressedSize, true);
    view.setUint32(currentCdOffset + 24, file.uncompressedSize, true);
    view.setUint16(currentCdOffset + 28, file.encodedName.length, true);
    view.setUint16(currentCdOffset + 30, 0, true);         // Extra field length
    view.setUint16(currentCdOffset + 32, 0, true);         // File comment length
    view.setUint16(currentCdOffset + 34, 0, true);         // Disk number start
    view.setUint16(currentCdOffset + 36, 0, true);         // Internal file attributes
    view.setUint32(currentCdOffset + 38, 0x81a40000, true);// External file attributes (regular Unix file -rw-r--r--)
    view.setUint32(currentCdOffset + 42, file.localHeaderOffset, true); // Relative offset of local header

    // File name
    archive.set(file.encodedName, currentCdOffset + 46);
    currentCdOffset += 46 + file.encodedName.length;
  }

  // 3. Write End of Central Directory Record (EOCD)
  view.setUint32(currentCdOffset + 0, 0x06054b50, true); // End of central dir signature
  view.setUint16(currentCdOffset + 4, 0, true);          // Number of this disk
  view.setUint16(currentCdOffset + 6, 0, true);          // Disk where central directory starts
  view.setUint16(currentCdOffset + 8, prepared.length, true); // Records on this disk
  view.setUint16(currentCdOffset + 10, prepared.length, true); // Total records
  view.setUint32(currentCdOffset + 12, cdSize, true); // Size of central directory
  view.setUint32(currentCdOffset + 16, cdOffset, true); // Offset of start of central directory
  view.setUint16(currentCdOffset + 20, 0, true);         // Comment length

  return archive;
}

/**
 * Creates a standard ZIP archive (PKZip 2.0 format) in memory.
 * By default, uses method 0 (Store) for maximum speed and zero dependencies.
 * Validates and sanitizes paths using sanitizeRelativePath.
 */
export function createZipArchive(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const prepared: PreparedZipEntry[] = [];
  const seenPaths = new Set<string>();

  let currentOffset = 0;

  for (const entry of entries) {
    const safePath = sanitizeRelativePath(entry.path);
    if (seenPaths.has(safePath)) {
      throw new Error(`Trùng đường dẫn tệp trong file ZIP: ${safePath}`);
    }
    seenPaths.add(safePath);

    const encodedName = encoder.encode(safePath);
    const date = entry.lastModified ?? new Date();
    const checksum = crc32(entry.data);
    const uncompressedSize = entry.data.byteLength;
    const compressedSize = uncompressedSize; // Store method
    const compressionMethod = 0; // Store

    prepared.push({
      safePath,
      encodedName,
      data: entry.data,
      crc: checksum,
      dosTime: toDosTime(date),
      dosDate: toDosDate(date),
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset: currentOffset,
    });

    // Local Header (30 bytes) + File Name + File Data
    currentOffset += 30 + encodedName.length + compressedSize;
  }

  const centralDirectoryOffset = currentOffset;
  let centralDirectorySize = 0;

  for (const file of prepared) {
    // Central Directory Header (46 bytes) + File Name
    centralDirectorySize += 46 + file.encodedName.length;
  }

  // End of Central Directory Record (22 bytes)
  const totalArchiveSize = centralDirectoryOffset + centralDirectorySize + 22;
  return serializeZipArchive(prepared, totalArchiveSize, centralDirectorySize, centralDirectoryOffset);
}

/**
 * Deflates bytes using native CompressionStream('deflate-raw') when available.
 */
export async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === "undefined") {
    return data;
  }
  try {
    const cs = new CompressionStream("deflate-raw");
    const writer = cs.writable.getWriter();
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    writer.write(copy as unknown as BufferSource);
    writer.close();
    const reader = cs.readable.getReader();
    const chunks: Uint8Array[] = [];
    let totalLength = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        totalLength += value.length;
      }
    }
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  } catch {
    return data;
  }
}

/**
 * Creates a ZIP archive with Deflate compression (method 8) via CompressionStream where available.
 * Automatically falls back to Store (method 0) if deflate is unsupported or yields a larger size.
 */
export async function createZipArchiveAsync(entries: ZipEntry[]): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const prepared: PreparedZipEntry[] = [];
  const seenPaths = new Set<string>();

  let currentOffset = 0;

  for (const entry of entries) {
    const safePath = sanitizeRelativePath(entry.path);
    if (seenPaths.has(safePath)) {
      throw new Error(`Trùng đường dẫn tệp trong file ZIP: ${safePath}`);
    }
    seenPaths.add(safePath);

    const encodedName = encoder.encode(safePath);
    const date = entry.lastModified ?? new Date();
    const checksum = crc32(entry.data);
    const uncompressedSize = entry.data.byteLength;

    let compressedData = entry.data;
    let compressionMethod = 0;

    if (uncompressedSize > 0) {
      const deflated = await deflateRaw(entry.data);
      if (deflated.byteLength < uncompressedSize) {
        compressedData = deflated;
        compressionMethod = 8;
      }
    }

    prepared.push({
      safePath,
      encodedName,
      data: compressedData,
      crc: checksum,
      dosTime: toDosTime(date),
      dosDate: toDosDate(date),
      compressionMethod,
      compressedSize: compressedData.byteLength,
      uncompressedSize,
      localHeaderOffset: currentOffset,
    });

    currentOffset += 30 + encodedName.length + compressedData.byteLength;
  }

  const centralDirectoryOffset = currentOffset;
  let centralDirectorySize = 0;

  for (const file of prepared) {
    centralDirectorySize += 46 + file.encodedName.length;
  }

  const totalArchiveSize = centralDirectoryOffset + centralDirectorySize + 22;
  return serializeZipArchive(prepared, totalArchiveSize, centralDirectorySize, centralDirectoryOffset);
}

/**
 * Triggers a browser download for the generated ZIP archive and cleans up the Object URL.
 */
export function downloadZipArchive(filename: string, entries: ZipEntry[]): void {
  const archiveBytes = createZipArchive(entries);
  if (typeof Blob === "undefined" || typeof URL === "undefined" || typeof document === "undefined") {
    return;
  }

  const copy = new Uint8Array(archiveBytes.byteLength);
  copy.set(archiveBytes);
  const blob = new Blob([copy.buffer], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const safeFilename = filename.toLowerCase().endsWith(".zip") ? filename : `${filename}.zip`;

  const link = document.createElement("a");
  link.href = url;
  link.download = safeFilename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    if (link.parentNode) {
      link.parentNode.removeChild(link);
    }
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Saves all entries into their nested directory hierarchy using the browser's
 * File System Access API (FileSystemDirectoryHandle).
 * Returns the count of files successfully saved.
 */
export async function saveEntriesToDirectory(
  entries: ZipEntry[],
  dirHandle: FileSystemDirectoryHandle,
): Promise<number> {
  let savedCount = 0;

  for (const entry of entries) {
    const safePath = sanitizeRelativePath(entry.path);
    const segments = safePath.split("/");
    const fileName = segments[segments.length - 1];
    const dirSegments = segments.slice(0, -1);

    let currentDir = dirHandle;
    for (const subDir of dirSegments) {
      currentDir = await currentDir.getDirectoryHandle(subDir, { create: true });
    }

    const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    const copy = new Uint8Array(entry.data.byteLength);
    copy.set(entry.data);
    await writable.write(copy.buffer);
    await writable.close();
    savedCount += 1;
  }

  return savedCount;
}
