import { join } from "@tauri-apps/api/path";
import { copyFile, exists, mkdir, readFile, readTextFile, remove, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { mimeFromExtension } from "./images";
import { ArticleMeta, Block } from "./types";

export interface DraftFields {
  title: string;
  author: string;
  publishedAt: string;
  sourceUrl: string;
  language: string;
  readAt: string;
  /** Missing in drafts written before tags existed. */
  tags?: string[];
}

export interface Draft {
  fields: DraftFields;
  blocks: Block[];
  /** Set when this draft edits a saved article rather than writing a new one. */
  editing?: { id: number; folderPath: string };
}

const urls = new Map<string, string>();

// Autosaves and discards run one at a time, so a slow write cannot bring a discarded draft back.
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

export function draftDir(root: string): Promise<string> {
  return join(root, "_drafts", "current");
}

export function draftFilePath(root: string, file: string): Promise<string> {
  return draftDir(root).then((dir) => join(dir, ...file.split("/")));
}

export function saveDraft(root: string, draft: Draft): Promise<void> {
  return enqueue(async () => {
    const dir = await draftDir(root);
    await mkdir(dir, { recursive: true });
    await writeTextFile(await join(dir, "draft.json"), JSON.stringify(draft, null, 2));
  });
}

export async function loadDraft(root: string): Promise<Draft | null> {
  const path = await join(await draftDir(root), "draft.json");
  if (!(await exists(path))) return null;
  return JSON.parse(await readTextFile(path)) as Draft;
}

export function discardDraft(root: string): Promise<void> {
  return enqueue(async () => {
    const dir = await draftDir(root);
    if (await exists(dir)) await remove(dir, { recursive: true });
    urls.forEach((url) => URL.revokeObjectURL(url));
    urls.clear();
  });
}

/**
 * Opens a saved article for editing by copying its images into a new draft.
 * The editor only ever touches the draft, so abandoning an edit leaves the article as it was.
 */
export async function createEditDraft(
  root: string,
  articlePath: string,
  meta: ArticleMeta,
  editing: { id: number; folderPath: string },
): Promise<Draft> {
  await discardDraft(root);
  const dir = await join(await draftDir(root), "images");
  await mkdir(dir, { recursive: true });
  const blocks: Block[] = [];
  for (const block of meta.blocks) {
    if (block.type !== "image") {
      blocks.push(block);
      continue;
    }
    const file = `images/${crypto.randomUUID()}.${block.file.split(".").pop()}`;
    await copyFile(await join(articlePath, ...block.file.split("/")), await draftFilePath(root, file));
    blocks.push({ ...block, file });
  }
  const draft: Draft = {
    fields: {
      title: meta.title,
      author: meta.author,
      publishedAt: meta.published_at,
      sourceUrl: meta.source_url,
      language: meta.language,
      readAt: meta.read_at,
      tags: meta.tags ?? [],
    },
    blocks,
    editing,
  };
  await saveDraft(root, draft);
  return draft;
}

/** Keeps the original bytes in the draft folder and returns the path to put in the block. */
export async function storeDraftImage(root: string, bytes: Uint8Array, extension: string): Promise<string> {
  const file = `images/${crypto.randomUUID()}.${extension}`;
  const dir = await join(await draftDir(root), "images");
  await mkdir(dir, { recursive: true });
  await writeFile(await draftFilePath(root, file), bytes);
  return file;
}

export async function removeDraftImage(root: string, file: string): Promise<void> {
  const path = await draftFilePath(root, file);
  if (await exists(path)) await remove(path);
  const url = urls.get(file);
  if (url) URL.revokeObjectURL(url);
  urls.delete(file);
}

export async function draftImageUrl(root: string, file: string): Promise<string> {
  const cached = urls.get(file);
  if (cached) return cached;
  const bytes = await readFile(await draftFilePath(root, file));
  const extension = file.split(".").pop() ?? "";
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeFromExtension(extension) }));
  urls.set(file, url);
  return url;
}
