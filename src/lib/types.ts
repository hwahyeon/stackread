export interface TextBlock {
  id: string;
  type: "text";
  html: string;
}

export interface ImageBlock {
  id: string;
  type: "image";
  file: string;
  caption: string;
  source_url?: string;
}

export type Block = TextBlock | ImageBlock;

/** Contents of meta.json. */
export interface ArticleMeta {
  title: string;
  author: string;
  published_at: string;
  source_url: string;
  language: string;
  read_at: string;
  blocks: Block[];
}

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "ru", label: "Русский" },
  { code: "ko", label: "한국어" },
] as const;

export function languageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code;
}
