import { effWords } from "./eff-wordlist";

export { effWords };

if (effWords.length !== 1296) {
  throw new Error(`EFF word list has ${effWords.length} entries; want 1296`);
}

declare const CodephraseBrand: unique symbol;
export type Codephrase = string & { readonly [CodephraseBrand]: true };

export function isCodephrase(value: unknown): value is Codephrase {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length < 6) return false;
  return /^[a-zA-Z0-9_-]+$/.test(trimmed);
}

export function asCodephrase(value: string): Codephrase {
  const trimmed = value.trim();
  if (!isCodephrase(trimmed)) {
    throw new Error(
      `Invalid codephrase: "${value}". Must be at least 6 characters and contain only letters, numbers, hyphens, and underscores.`,
    );
  }
  return trimmed as Codephrase;
}

export function secureRandomIndex(upperBound: number) {
  if (!Number.isSafeInteger(upperBound) || upperBound < 1) {
    throw new RangeError("upperBound must be a positive safe integer");
  }

  const range = 0x1_0000_0000;
  const limit = range - (range % upperBound);
  const value = new Uint32Array(1);
  do {
    crypto.getRandomValues(value);
  } while (value[0] >= limit);
  return value[0] % upperBound;
}

export function generateCode(
  selectIndex: (upperBound: number) => number = secureRandomIndex,
): Codephrase {
  return Array.from(
    { length: 3 },
    () => effWords[selectIndex(effWords.length)],
  ).join("-") as Codephrase;
}

const effWordSet = new Set(effWords);

function effSequence(secret: string, count: number): string[] | undefined {
  const parts = secret.split("-");
  if (parts.length < count || parts.length > count * 2) return;
  const words: string[] = [];
  const visit = (start: number): boolean => {
    if (words.length === count) return start === parts.length;
    for (let end = start + 1; end <= parts.length; end++) {
      const word = parts.slice(start, end).join("-");
      if (!effWordSet.has(word)) continue;
      words.push(word);
      if (visit(end)) return true;
      words.pop();
    }
    return false;
  };
  if (visit(0)) return words;
}

async function digestHex(bytes: Uint8Array) {
  const hash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", bytes.slice()),
  );
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export async function codeComponents(secret: string | Codephrase) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(secret);
  if (bytes.length < 6) {
    throw new Error("code is too short (must be at least 6 characters)");
  }
  let selector = bytes.slice(0, 4);
  let passphrase = new TextDecoder().decode(bytes.subarray(5));
  let format: "legacy" | "three-word" | "four-word" = "legacy";

  const words =
    effSequence(secret, 3) ??
    (/^[a-z]+-[a-z]+-[a-z]+$/.test(secret) ? secret.split("-") : undefined);

  if (words) {
    selector = encoder.encode(words[0]);
    passphrase = words.slice(1).join("-");
    format = "three-word";
  } else if (/^[a-z]+-[a-z]+-[a-z]+-[a-z]+$/.test(secret)) {
    const four = secret.split("-");
    selector = encoder.encode(four.slice(0, 2).join("-"));
    passphrase = four.slice(2).join("-");
    format = "four-word";
  }

  const roomBytes = new Uint8Array(selector.length + 4);
  roomBytes.set(selector);
  roomBytes.set(encoder.encode("croc"), selector.length);
  return { room: await digestHex(roomBytes), passphrase, format };
}

export async function sshCodeComponents(secret: string | Codephrase) {
  const { room, passphrase } = await codeComponents(secret);
  return { room, passphrase };
}

export async function generateOptimizedCodephrase(
  targetRelayIndex: number,
  relayCount: number = 4,
  maxAttempts: number = 200,
): Promise<Codephrase> {
  if (
    !Number.isSafeInteger(targetRelayIndex) ||
    targetRelayIndex < 0 ||
    targetRelayIndex >= relayCount
  ) {
    throw new RangeError(
      `targetRelayIndex must be an integer between 0 and ${relayCount - 1}, received ${targetRelayIndex}`,
    );
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = generateCode();
    if ((await relayIndex(candidate, relayCount)) === targetRelayIndex) {
      return candidate;
    }
  }

  return generateCode();
}

export async function relayIndex(secret: string | Codephrase, count: number) {
  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new Error("relay count must be positive");
  }
  const hash = await digestHex(new TextEncoder().encode(secret));
  return Number(BigInt("0x" + hash) % BigInt(count));
}
