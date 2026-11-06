import { join } from "@tauri-apps/api/path";
import { exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

export interface Language {
  code: string;
  label: string;
}

const DEFAULT_LANGUAGES: readonly Language[] = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "ru", label: "Русский" },
  { code: "ko", label: "한국어" },
];

// The code becomes the lang attribute of article.html, so it follows the BCP 47 shape.
const CODE_PATTERN = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/;

// Held here rather than in React state because article rendering needs labels too.
let current: readonly Language[] = DEFAULT_LANGUAGES;

export function languages(): readonly Language[] {
  return current;
}

export function languageLabel(code: string): string {
  return current.find((l) => l.code === code)?.label ?? code;
}

/** Kept in the save root so the list moves with the folder, like the articles it describes. */
function languagesPath(root: string): Promise<string> {
  return join(root, "languages.json");
}

function isLanguageList(value: unknown): value is Language[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((l) => typeof l?.code === "string" && typeof l?.label === "string")
  );
}

export async function loadLanguages(root: string): Promise<void> {
  current = DEFAULT_LANGUAGES;
  const path = await languagesPath(root);
  if (!(await exists(path))) return;
  const parsed: unknown = JSON.parse(await readTextFile(path));
  if (!isLanguageList(parsed)) throw new Error("languages.json 형식이 올바르지 않습니다");
  current = parsed;
}

async function store(root: string, list: Language[]): Promise<void> {
  await writeTextFile(await languagesPath(root), `${JSON.stringify(list, null, 2)}\n`);
  current = list;
}

export async function addLanguage(root: string, code: string, label: string): Promise<void> {
  const cleanCode = code.trim().toLowerCase();
  const cleanLabel = label.trim();
  if (!CODE_PATTERN.test(cleanCode)) throw new Error("코드는 fr, zh-tw처럼 영문 소문자로 입력해 주세요");
  if (!cleanLabel) throw new Error("이름을 입력해 주세요");
  if (current.some((l) => l.code === cleanCode)) throw new Error(`이미 있는 코드입니다: ${cleanCode}`);
  if (current.some((l) => l.label === cleanLabel)) throw new Error(`이미 있는 이름입니다: ${cleanLabel}`);
  await store(root, [...current, { code: cleanCode, label: cleanLabel }]);
}

export async function removeLanguage(root: string, code: string): Promise<void> {
  if (current.length <= 1) throw new Error("언어는 하나 이상 있어야 합니다");
  await store(root, current.filter((l) => l.code !== code));
}
