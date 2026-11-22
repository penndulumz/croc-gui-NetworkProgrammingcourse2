import { effWords } from "../protocol/croc/eff-wordlist";

export interface GroupPassphraseRecord {
  id: string;
  groupName: string;
  sharedSecret: string;
  rotationCycle: "monthly";
  createdAt: number;
}

export interface DerivedGroupCode {
  period: string;
  codephrase: string;
  nextRotationDate: string;
  fingerprint: string;
}

const GROUP_STORAGE_KEY = "crocflow-group-passphrases-v1";

export function formatMonthlyPeriod(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function getNextMonthlyRotationDate(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return "01 tháng sau";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}

/**
 * Deterministically derives a Croc-compatible 3-word EFF Codephrase bound to a
 * shared team secret and a monthly rotation cycle (YYYY-MM) using HKDF-SHA-256.
 */
export async function deriveMonthlyGroupCode(
  sharedSecret: string,
  period: string = formatMonthlyPeriod(),
): Promise<DerivedGroupCode> {
  const secret = sharedSecret.trim();
  if (secret.length < 4) {
    throw new Error("Mật khẩu nhóm cần tối thiểu 4 ký tự");
  }
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    "HKDF",
    false,
    ["deriveBits"],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encoder.encode(`crocflow-group-v1:${period}`),
      info: encoder.encode("monthly-rotating-codephrase"),
    },
    keyMaterial,
    256,
  );
  const bytes = new Uint8Array(derivedBits);
  const view = new DataView(bytes.buffer);

  const w1 = effWords[view.getUint32(0, false) % effWords.length];
  const w2 = effWords[view.getUint32(4, false) % effWords.length];
  const w3 = effWords[view.getUint32(8, false) % effWords.length];
  const fingerprint = Array.from(bytes.slice(12, 16), (b) => b.toString(16).padStart(2, "0")).join("");

  return {
    period,
    codephrase: `${w1}-${w2}-${w3}`,
    nextRotationDate: getNextMonthlyRotationDate(period),
    fingerprint,
  };
}

export function loadGroupPassphrases(): GroupPassphraseRecord[] {
  try {
    const raw = localStorage.getItem(GROUP_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GroupPassphraseRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveGroupPassphrases(records: GroupPassphraseRecord[]): void {
  try {
    localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Ignore storage write errors
  }
}
