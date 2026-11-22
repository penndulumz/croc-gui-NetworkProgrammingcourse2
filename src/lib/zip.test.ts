import test from "node:test";
import assert from "node:assert/strict";
import {
  createZipArchive,
  createZipArchiveAsync,
  crc32,
  downloadZipArchive,
  saveEntriesToDirectory,
  serializeZipArchive,
  toDosDate,
  toDosTime,
  type PreparedZipEntry,
  type ZipEntry,
} from "./zip";

test("crc32 calculates accurate checksums across standard vectors", () => {
  // Empty data vector
  assert.equal(crc32(new Uint8Array(0)), 0);

  // Standard "123456789" check vector -> 0xCBF43926 = 3421760262
  const standardAscii = new TextEncoder().encode("123456789");
  assert.equal(crc32(standardAscii), 0xcbf43926);

  // Pangram check vector
  const pangram = new TextEncoder().encode("The quick brown fox jumps over the lazy dog");
  assert.equal(crc32(pangram), 0x414fa339);
});

test("toDosDate and toDosTime convert dates to valid MS-DOS 16-bit values", () => {
  const d = new Date(2026, 10, 22, 14, 30, 40); // 2026-11-22 14:30:40
  const dosTime = toDosTime(d);
  const dosDate = toDosDate(d);

  // Time: (14 << 11) | (30 << 5) | 20
  const expectedTime = (14 << 11) | (30 << 5) | 20;
  assert.equal(dosTime, expectedTime);

  // Date: ((2026 - 1980) << 9) | (11 << 5) | 22
  const expectedDate = (46 << 9) | (11 << 5) | 22;
  assert.equal(dosDate, expectedDate);
});

test("createZipArchive generates valid ZIP magic headers and central directory structure", () => {
  const enc = new TextEncoder();
  const entries: ZipEntry[] = [
    {
      path: "folder/hello.txt",
      data: enc.encode("Hello World!"),
      lastModified: new Date("2026-01-01T10:00:00Z"),
    },
    {
      path: "nested/dir/sample.bin",
      data: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
      lastModified: new Date("2026-02-01T12:00:00Z"),
    },
  ];

  const archive = createZipArchive(entries);
  assert.ok(archive.byteLength > 0);
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);

  // 1. Check Local File Header 1 magic: PK\x03\x04 (0x04034b50)
  assert.equal(view.getUint32(0, true), 0x04034b50);

  // 2. Locate Central Directory & End of Central Directory
  // EOCD magic is at the end: PK\x05\x06 (0x06054b50)
  const eocdOffset = archive.byteLength - 22;
  assert.equal(view.getUint32(eocdOffset, true), 0x06054b50);

  // Verify total records = 2
  assert.equal(view.getUint16(eocdOffset + 8, true), 2);
  assert.equal(view.getUint16(eocdOffset + 10, true), 2);

  const cdSize = view.getUint32(eocdOffset + 12, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);
  assert.ok(cdOffset > 0);
  assert.ok(cdSize > 0);

  // Verify Central Directory starts with magic: PK\x01\x02 (0x02014b50)
  assert.equal(view.getUint32(cdOffset, true), 0x02014b50);

  // Parse entries from Central Directory
  const foundPaths: string[] = [];
  let cur = cdOffset;
  const dec = new TextDecoder();

  while (cur < cdOffset + cdSize) {
    const magic = view.getUint32(cur, true);
    assert.equal(magic, 0x02014b50);

    const nameLen = view.getUint16(cur + 28, true);
    const extraLen = view.getUint16(cur + 30, true);
    const commentLen = view.getUint16(cur + 32, true);

    const nameBytes = archive.subarray(cur + 46, cur + 46 + nameLen);
    foundPaths.push(dec.decode(nameBytes));

    cur += 46 + nameLen + extraLen + commentLen;
  }

  assert.deepEqual(foundPaths, ["folder/hello.txt", "nested/dir/sample.bin"]);
});

test("createZipArchive rejects directory traversal and absolute paths", () => {
  const enc = new TextEncoder();

  // Rejects .. traversal
  assert.throws(
    () => {
      createZipArchive([
        {
          path: "../../etc/passwd",
          data: enc.encode("malicious"),
        },
      ]);
    },
    /leo thư mục|path traversal/i,
  );

  // Rejects absolute path with leading slash
  assert.throws(
    () => {
      createZipArchive([
        {
          path: "/root/secrets.txt",
          data: enc.encode("malicious"),
        },
      ]);
    },
    /tuyệt đối/i,
  );

  // Rejects empty path
  assert.throws(
    () => {
      createZipArchive([
        {
          path: "   ",
          data: enc.encode("empty"),
        },
      ]);
    },
    /trống/i,
  );
});

test("createZipArchiveAsync supports Deflate and falls back cleanly", async () => {
  const enc = new TextEncoder();
  const text = "CrocFlow Secure Transfer ".repeat(200); // Highly compressible
  const entries: ZipEntry[] = [
    {
      path: "compressed/sample.txt",
      data: enc.encode(text),
    },
  ];

  const archive = await createZipArchiveAsync(entries);
  assert.ok(archive.byteLength > 0);

  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  assert.equal(view.getUint32(0, true), 0x04034b50);

  // Verify EOCD magic
  const eocdOffset = archive.byteLength - 22;
  assert.equal(view.getUint32(eocdOffset, true), 0x06054b50);
});

test("saveEntriesToDirectory constructs nested subfolders and writes files", async () => {
  const enc = new TextEncoder();
  const entries: ZipEntry[] = [
    {
      path: "level1/level2/fileA.txt",
      data: enc.encode("Content A"),
    },
    {
      path: "level1/fileB.txt",
      data: enc.encode("Content B"),
    },
  ];

  const writtenFiles = new Map<string, Uint8Array>();
  const subDirs = new Map<string, any>();

  function createMockDir(dirPath = ""): any {
    return {
      kind: "directory",
      async getDirectoryHandle(subName: string, opts?: { create?: boolean }) {
        const fullPath = dirPath ? `${dirPath}/${subName}` : subName;
        if (!subDirs.has(fullPath)) {
          if (!opts?.create) throw new Error("Directory not found");
          subDirs.set(fullPath, createMockDir(fullPath));
        }
        return subDirs.get(fullPath);
      },
      async getFileHandle(fileName: string, opts?: { create?: boolean }) {
        const fullPath = dirPath ? `${dirPath}/${fileName}` : fileName;
        return {
          kind: "file",
          name: fileName,
          async createWritable() {
            let received: Uint8Array = new Uint8Array(0);
            return {
              async write(chunk: ArrayBuffer) {
                received = new Uint8Array(chunk);
              },
              async close() {
                writtenFiles.set(fullPath, received);
              },
            };
          },
        };
      },
    };
  }

  const rootHandle = createMockDir() as unknown as FileSystemDirectoryHandle;
  const count = await saveEntriesToDirectory(entries, rootHandle);

  assert.equal(count, 2);
  assert.ok(subDirs.has("level1"));
  assert.ok(subDirs.has("level1/level2"));
  assert.equal(new TextDecoder().decode(writtenFiles.get("level1/level2/fileA.txt")), "Content A");
  assert.equal(new TextDecoder().decode(writtenFiles.get("level1/fileB.txt")), "Content B");
});

test("downloadZipArchive executes safely in non-browser environment without errors", () => {
  const enc = new TextEncoder();
  assert.doesNotThrow(() => {
    downloadZipArchive("test.zip", [
      {
        path: "test.txt",
        data: enc.encode("test"),
      },
    ]);
  });
});

test("serializeZipArchive constructs valid ZIP archive from prepared entries", () => {
  const enc = new TextEncoder();
  const name = enc.encode("doc.txt");
  const data = enc.encode("Zip serialization helper test");
  const prepared: PreparedZipEntry[] = [
    {
      safePath: "doc.txt",
      encodedName: name,
      data,
      crc: crc32(data),
      dosTime: 0,
      dosDate: 0,
      compressionMethod: 0,
      compressedSize: data.byteLength,
      uncompressedSize: data.byteLength,
      localHeaderOffset: 0,
    },
  ];
  const cdOffset = 30 + name.length + data.byteLength;
  const cdSize = 46 + name.length;
  const totalSize = cdOffset + cdSize + 22;

  const archive = serializeZipArchive(prepared, totalSize, cdSize, cdOffset);
  assert.equal(archive.byteLength, totalSize);
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  assert.equal(view.getUint32(0, true), 0x04034b50); // Local file header
  assert.equal(view.getUint32(cdOffset, true), 0x02014b50); // Central directory header
  assert.equal(view.getUint32(totalSize - 22, true), 0x06054b50); // EOCD header
});
