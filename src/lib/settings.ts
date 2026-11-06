import { appConfigDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { open } from "@tauri-apps/plugin-dialog";

async function settingsPath(): Promise<string> {
  return join(await appConfigDir(), "settings.json");
}

/** The remembered save root, or null when none is set or the folder is gone. */
export async function loadRoot(): Promise<string | null> {
  const path = await settingsPath();
  if (!(await exists(path))) return null;
  const { root } = JSON.parse(await readTextFile(path)) as { root?: string };
  return root && (await exists(root)) ? root : null;
}

/** Asks for a folder. The dialog grants access to it, and persisted-scope keeps that across runs. */
export async function chooseRoot(): Promise<string | null> {
  const root = await open({ directory: true, recursive: true, title: "기사를 저장할 폴더 선택" });
  if (!root) return null;
  await mkdir(await appConfigDir(), { recursive: true });
  await writeTextFile(await settingsPath(), JSON.stringify({ root }, null, 2));
  return root;
}
