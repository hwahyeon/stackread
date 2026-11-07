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
  /** Missing in articles saved before tags existed. */
  tags?: string[];
  blocks: Block[];
}

/** Trims, drops a leading #, and removes empty and repeated tags. */
export function cleanTags(tags: string[]): string[] {
  const seen = new Set<string>();
  for (const tag of tags) {
    const clean = tag.trim().replace(/^#+/, "").replace(/\s+/g, " ").trim();
    if (clean) seen.add(clean);
  }
  return [...seen];
}
