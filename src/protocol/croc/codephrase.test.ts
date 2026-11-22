import test from "node:test";
import assert from "node:assert/strict";
import {
  codeComponents,
  effWords,
  generateCode,
  relayIndex,
} from "./codephrase.ts";

test("effWords loads all 1296 official EFF short wordlist entries", () => {
  assert.equal(effWords.length, 1296);
});

test("generateCode produces a valid 3-word hyphenated Croc v11 codephrase", async () => {
  const code = generateCode();
  const parsed = await codeComponents(code);
  assert.equal(parsed.format, "three-word");
  assert.equal(parsed.room.length, 64);
  assert.ok(parsed.passphrase.length > 0);
});

test("codeComponents parses four-word and legacy codes deterministically", async () => {
  const four = await codeComponents("alpha-bravo-charlie-delta");
  assert.equal(four.format, "four-word");
  assert.equal(four.passphrase, "charlie-delta");

  const legacy = await codeComponents("1234-secret-pass");
  assert.equal(legacy.format, "legacy");
  assert.equal(legacy.passphrase, "secret-pass");

  await assert.rejects(() => codeComponents("abc"), /at least 6 characters/);
});

test("relayIndex maps a codephrase deterministically to a valid public relay index", async () => {
  const first = await relayIndex("acid-acorn-acre", 4);
  const second = await relayIndex("acid-acorn-acre", 4);
  assert.equal(first, second);
  assert.ok(first >= 0 && first < 4);
});
