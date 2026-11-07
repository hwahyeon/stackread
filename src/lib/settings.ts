import { appConfigDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { open } from "@tauri-apps/plugin-dialog";

export type Theme = "system" | "light" | "dark";

interface Settings {
  root?: string;
  theme?: Theme;
  pageSize?: number;
}

export const PAGE_SIZES = [10, 20, 30, 50, 100];
export const DEFAULT_PAGE_SIZE = 30;

async function settingsPath(): Promise<string> {
  return join(await appConfigDir(), "settings.json");
}

async function readSettings(): Promise<Settings> {
  const path = await settingsPath();
  return (await exists(path)) ? (JSON.parse(await readTextFile(path)) as Settings) : {};
}

/** Changes some settings and keeps the rest. */
async function writeSettings(change: Settings): Promise<void> {
  const next = { ...(await readSettings()), ...change };
  await mkdir(await appConfigDir(), { recursive: true });
  await writeTextFile(await settingsPath(), JSON.stringify(next, null, 2));
}

/** The remembered save root, or null when none is set or the folder is gone. */
export async function loadRoot(): Promise<string | null> {
  const { root } = await readSettings();
  return root && (await exists(root)) ? root : null;
}

export async function loadTheme(): Promise<Theme> {
  const { theme } = await readSettings();
  return theme === "light" || theme === "dark" ? theme : "system";
}

export async function saveTheme(theme: Theme): Promise<void> {
  await writeSettings({ theme });
}

/** "system" leaves the colours to Windows; the others fix them. */
export function applyTheme(theme: Theme): void {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

/** Articles per page in the list. */
export async function loadPageSize(): Promise<number> {
  const { pageSize } = await readSettings();
  return pageSize !== undefined && PAGE_SIZES.includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE;
}

export async function savePageSize(pageSize: number): Promise<void> {
  await writeSettings({ pageSize });
}

export function currentTheme(): Theme {
  const theme = document.documentElement.dataset.theme;
  return theme === "light" || theme === "dark" ? theme : "system";
}

/** Asks for a folder. The dialog grants access to it, and persisted-scope keeps that across runs. */
export async function chooseRoot(): Promise<string | null> {
  const root = await open({ directory: true, recursive: true, title: "기사를 저장할 폴더 선택" });
  if (!root) return null;
  await writeSettings({ root });
  return root;
}
