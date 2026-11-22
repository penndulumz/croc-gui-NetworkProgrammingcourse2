import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeCodephraseInput } from "../components/ReceiveView";

test("sanitizeCodephraseInput strips terminal croc command prefixes", () => {
  assert.equal(sanitizeCodephraseInput("croc 4281-apple-orange"), "4281-apple-orange");
  assert.equal(sanitizeCodephraseInput("croc send 4281-apple-orange"), "4281-apple-orange");
  assert.equal(sanitizeCodephraseInput("  croc   9999-alpha-beta  "), "9999-alpha-beta");
});

test("sanitizeCodephraseInput normalizes casing, spaces, and hyphens", () => {
  assert.equal(sanitizeCodephraseInput("4281 Apple Orange"), "4281-apple-orange");
  assert.equal(sanitizeCodephraseInput("4281_APPLE_ORANGE"), "4281-apple-orange");
  assert.equal(sanitizeCodephraseInput("4281---apple--orange"), "4281-apple-orange");
});

test("sanitizeCodephraseInput strips disallowed punctuation characters", () => {
  assert.equal(sanitizeCodephraseInput("4281-apple$#@!"), "4281-apple");
  assert.equal(sanitizeCodephraseInput("test@example.com-code"), "testexamplecom-code");
});
