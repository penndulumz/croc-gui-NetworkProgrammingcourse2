import test from "node:test";
import assert from "node:assert/strict";
import {
  asCodephrase,
  codeComponents,
  effWords,
  generateCode,
  generateOptimizedCodephrase,
  isCodephrase,
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

test("isCodephrase validates valid codephrases and rejects malformed inputs", () => {
  assert.equal(isCodephrase("acid-acorn-acre"), true);
  assert.equal(isCodephrase("alpha-bravo-charlie-delta"), true);
  assert.equal(isCodephrase("1234-secret-pass"), true);
  assert.equal(isCodephrase("crocflow-failover-test-99"), true);
  assert.equal(isCodephrase("abc"), false); // too short (< 6 chars)
  assert.equal(isCodephrase("   "), false);
  assert.equal(isCodephrase("hello world"), false); // contains space
  assert.equal(isCodephrase("code$phrase!"), false); // invalid characters
  assert.equal(isCodephrase(null), false);
  assert.equal(isCodephrase(undefined), false);
  assert.equal(isCodephrase(123456), false);
  assert.equal(isCodephrase({}), false);
});

test("asCodephrase returns branded Codephrase or throws on invalid input", () => {
  const code = asCodephrase("acid-acorn-acre");
  assert.equal(code, "acid-acorn-acre");
  assert.throws(() => asCodephrase("short"), /Invalid codephrase/);
  assert.throws(() => asCodephrase("has space here"), /Invalid codephrase/);
});

test("generateOptimizedCodephrase returns valid codephrase matching target index for 0, 1, 2, 3 under 50ms", async () => {
  const started = performance.now();
  for (let target = 0; target < 4; target++) {
    const phrase = await generateOptimizedCodephrase(target, 4);
    assert.equal(isCodephrase(phrase), true);
    const mapped = await relayIndex(phrase, 4);
    assert.equal(mapped, target);
  }
  const totalMs = performance.now() - started;
  assert.ok(totalMs < 50, `Expected total runtime < 50ms, took ${totalMs.toFixed(2)}ms`);
});
