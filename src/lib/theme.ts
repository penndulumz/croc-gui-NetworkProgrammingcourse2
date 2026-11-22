export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "crocflow-theme";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function resolveInitialTheme(
  storage?: StorageLike | null,
  prefersDark = true,
): ThemeMode {
  try {
    const saved = storage?.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") {
      return saved;
    }
  } catch {
    // Ignore storage access errors in restricted environments
  }
  return prefersDark ? "dark" : "light";
}

export function toggleThemeMode(current: ThemeMode): ThemeMode {
  return current === "dark" ? "light" : "dark";
}

export function persistTheme(mode: ThemeMode, storage?: StorageLike | null): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Ignore storage write errors
  }
}

export function applyThemeToDocument(mode: ThemeMode): void {
  if (typeof document === "undefined") return;
  const isDark = mode === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = mode;
}
