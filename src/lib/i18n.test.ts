import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DICTIONARY,
  getTranslations,
  persistLocale,
  resolveInitialLocale,
  type Locale,
} from "./i18n";

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

test("resolveInitialLocale restores persisted locale", () => {
  const storage = new MemoryStorage();
  storage.setItem("crocflow-locale", "en");
  assert.equal(resolveInitialLocale(storage), "en");

  storage.setItem("crocflow-locale", "vi");
  assert.equal(resolveInitialLocale(storage), "vi");
});

test("resolveInitialLocale falls back cleanly when empty or malformed", () => {
  const storage = new MemoryStorage();
  assert.equal(resolveInitialLocale(storage), "vi");

  storage.setItem("crocflow-locale", "invalid-lang");
  assert.equal(resolveInitialLocale(storage), "vi");

  assert.equal(resolveInitialLocale(null), "vi");
});

test("persistLocale stores locale cleanly", () => {
  const storage = new MemoryStorage();
  persistLocale("en", storage);
  assert.equal(storage.getItem("crocflow-locale"), "en");
  persistLocale("vi", storage);
  assert.equal(storage.getItem("crocflow-locale"), "vi");
});

test("all translation keys match between vi and en", () => {
  const vi = DICTIONARY.vi;
  const en = DICTIONARY.en;

  const compareKeys = (objA: Record<string, any>, objB: Record<string, any>, path = "") => {
    const keysA = Object.keys(objA).sort();
    const keysB = Object.keys(objB).sort();
    assert.deepEqual(
      keysA,
      keysB,
      `Mismatch in translation keys at ${path || "root"}: ${JSON.stringify(keysA)} vs ${JSON.stringify(keysB)}`,
    );

    for (const key of keysA) {
      if (typeof objA[key] === "object" && objA[key] !== null) {
        compareKeys(objA[key], objB[key], `${path}.${key}`);
      } else {
        assert.equal(typeof objA[key], "string", `Key ${path}.${key} in vi is not a string`);
        assert.equal(typeof objB[key], "string", `Key ${path}.${key} in en is not a string`);
        assert.ok(objA[key].length > 0, `Key ${path}.${key} in vi is empty`);
        assert.ok(objB[key].length > 0, `Key ${path}.${key} in en is empty`);
      }
    }
  };

  compareKeys(vi, en);
});

test("getTranslations returns matching translations", () => {
  const viT = getTranslations("vi");
  assert.equal(viT.common.appName, "CrocFlow");
  assert.equal(viT.common.vietnamese, "Tiếng Việt");

  const enT = getTranslations("en");
  assert.equal(enT.common.appName, "CrocFlow");
  assert.equal(enT.common.english, "English");
});

test("all action button translations strictly enforce 1 to 3 word economy", () => {
  const checkButtons = (obj: Record<string, any>, lang: string, path = "") => {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "object" && value !== null) {
        checkButtons(value, lang, `${path}.${key}`);
      } else if (key.endsWith("Btn")) {
        const words = value.trim().split(/\s+/).filter(Boolean);
        assert.ok(
          words.length >= 1 && words.length <= 3,
          `Button label '${value}' at ${path}.${key} in ${lang} has ${words.length} words; expected 1-3 words`,
        );
      }
    }
  };

  checkButtons(DICTIONARY.vi, "vi");
  checkButtons(DICTIONARY.en, "en");
});
