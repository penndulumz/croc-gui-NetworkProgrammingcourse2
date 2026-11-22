import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveMonthlyGroupCode,
  formatMonthlyPeriod,
  getNextMonthlyRotationDate,
} from "./group-passphrase.ts";

test("deriveMonthlyGroupCode is deterministic within the same YYYY-MM period", async () => {
  const first = await deriveMonthlyGroupCode("nhom-mang-k68", "2026-11");
  const second = await deriveMonthlyGroupCode("nhom-mang-k68", "2026-11");
  assert.equal(first.codephrase, second.codephrase);
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(first.codephrase.split("-").length, 3);
  assert.equal(first.nextRotationDate, "2026-12-01");
});

test("deriveMonthlyGroupCode rotates cryptographically across consecutive months", async () => {
  const nov = await deriveMonthlyGroupCode("nhom-mang-k68", "2026-11");
  const dec = await deriveMonthlyGroupCode("nhom-mang-k68", "2026-12");
  assert.notEqual(nov.codephrase, dec.codephrase);
  assert.notEqual(nov.fingerprint, dec.fingerprint);
  assert.equal(getNextMonthlyRotationDate("2026-12"), "2027-01-01");
});

test("formatMonthlyPeriod formats UTC year and month cleanly", () => {
  assert.equal(formatMonthlyPeriod(new Date("2026-03-15T10:00:00Z")), "2026-03");
});
