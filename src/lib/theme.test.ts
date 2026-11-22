import test from "node:test";
import assert from "node:assert/strict";
import {
  persistTheme,
  resolveInitialTheme,
  THEME_STORAGE_KEY,
  toggleThemeMode,
} from "./theme.ts";

function makeMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

test("resolveInitialTheme restores persisted preference over OS default", () => {
  const storage = makeMemoryStorage();
  storage.setItem(THEME_STORAGE_KEY, "light");
  assert.equal(resolveInitialTheme(storage, true), "light");

  storage.setItem(THEME_STORAGE_KEY, "dark");
  assert.equal(resolveInitialTheme(storage, false), "dark");
});

test("resolveInitialTheme falls back to system preference when storage is empty or invalid", () => {
  const storage = makeMemoryStorage();
  assert.equal(resolveInitialTheme(storage, true), "dark");
  assert.equal(resolveInitialTheme(storage, false), "light");

  storage.setItem(THEME_STORAGE_KEY, "neon");
  assert.equal(resolveInitialTheme(storage, false), "light");
});

test("toggleThemeMode and persistTheme round-trip cleanly", () => {
  const storage = makeMemoryStorage();
  const next = toggleThemeMode("dark");
  assert.equal(next, "light");
  persistTheme(next, storage);
  assert.equal(resolveInitialTheme(storage, true), "light");
});
