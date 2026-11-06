import { invoke } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { copyFile, exists, mkdir, readDir, readTextFile, remove, rename, writeTextFile } from "@tauri-apps/plugin-fs";
import Database from "@tauri-apps/plugin-sql";
import { draftFilePath } from "./draft";
import { folderNameFromTitle } from "./folderName";
import { IndexRow, renderArticleHtml, renderIndexHtml } from "./render";
import { sanitizeTextHtml, textHtmlToPlain } from "./textHtml";
import { ArticleMeta, Block } from "./types";

const TRASH_FOLDER = "_trash";
// Staging and replaced folders live here, so a rebuild of the index never reads them.
const WORK_FOLDER = "_drafts";

let opened: { url: string; db: Database } | null = null;

async function openIndex(root: string): Promise<{ url: string; db: Database }> {
  const url = `sqlite:${await join(root, "archive.db")}`;
  if (opened?.url === url) return opened;
  const db = await Database.load(url);
  await invoke("index_migrate", { db: url });
  opened = { url, db };
  return opened;
}

export interface ArticleRow {
  id: number;
  title: string;
  author: string;
  language: string;
  read_at: string;
  folder_path: string;
}

export interface ArticleFilter {
  query: string;
  language: string;
  from: string;
  to: string;
  order: "newest" | "oldest";
}

// Trigram matching needs at least 3 characters; shorter terms fall back to LIKE.
const TRIGRAM_MIN_LENGTH = 3;

export async function listArticles(root: string, filter: ArticleFilter): Promise<ArticleRow[]> {
  const { db } = await openIndex(root);
  const where: string[] = [];
  const values: string[] = [];
  const bind = (value: string) => `$${values.push(value)}`;

  if (filter.language) where.push(`language = ${bind(filter.language)}`);
  if (filter.from) where.push(`read_at >= ${bind(filter.from)}`);
  if (filter.to) where.push(`read_at <= ${bind(filter.to)}`);
  for (const term of filter.query.split(/\s+/).filter(Boolean)) {
    if (Array.from(term).length >= TRIGRAM_MIN_LENGTH) {
      const phrase = bind(`"${term.replace(/"/g, '""')}"`);
      where.push(`id IN (SELECT rowid FROM articles_fts WHERE articles_fts MATCH ${phrase})`);
    } else {
      const like = bind(`%${term.replace(/[\\%_]/g, "\\$&")}%`);
      where.push(`id IN (SELECT rowid FROM articles_fts WHERE title LIKE ${like} ESCAPE '\\' OR body LIKE ${like} ESCAPE '\\')`);
    }
  }
  const direction = filter.order === "oldest" ? "ASC" : "DESC";
  return db.select<ArticleRow[]>(
    `SELECT id, title, COALESCE(author, '') AS author, language, read_at, folder_path FROM articles
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY read_at ${direction}, id ${direction}`,
    values,
  );
}

/** Articles read per day ("YYYY-MM-DD") in an inclusive range; days without any are absent. */
export async function countByDay(root: string, from: string, to: string, language: string): Promise<Map<string, number>> {
  const { db } = await openIndex(root);
  const values = language ? [from, to, language] : [from, to];
  const rows = await db.select<{ day: string; count: number }[]>(
    `SELECT read_at AS day, COUNT(*) AS count FROM articles
     WHERE read_at >= $1 AND read_at <= $2 ${language ? "AND language = $3" : ""}
     GROUP BY read_at`,
    values,
  );
  return new Map(rows.map((row) => [row.day, row.count]));
}

/** Saved articles per language code; languages without any are absent. */
export async function countByLanguage(root: string): Promise<Map<string, number>> {
  const { db } = await openIndex(root);
  const rows = await db.select<{ language: string; count: number }[]>(
    "SELECT language, COUNT(*) AS count FROM articles GROUP BY language",
  );
  return new Map(rows.map((row) => [row.language, row.count]));
}

export function articleDir(root: string, folderPath: string): Promise<string> {
  return join(root, ...folderPath.split("/"));
}

export async function readArticleMeta(root: string, folderPath: string): Promise<ArticleMeta> {
  const path = await join(await articleDir(root, folderPath), "meta.json");
  return JSON.parse(await readTextFile(path)) as ArticleMeta;
}

/** Same title on the same day gets _2, _3, so each save stays its own record. */
async function freeFolder(root: string, dateDir: string, name: string): Promise<string> {
  for (let n = 1; ; n++) {
    const candidate = `${dateDir}/${n === 1 ? name : `${name}_${n}`}`;
    if (!(await exists(await articleDir(root, candidate)))) return candidate;
  }
}

function dateFolder(readAt: string): string {
  return readAt.split("-").join("/");
}

/** Drops blocks left empty and reduces text to the allowed tags. */
export function prepareBlocks(blocks: Block[]): Block[] {
  return blocks.flatMap((b): Block[] => {
    if (b.type === "image") return b.file ? [b] : [];
    const html = sanitizeTextHtml(b.html);
    return textHtmlToPlain(html).trim() ? [{ ...b, html }] : [];
  });
}

function plainBody(blocks: Block[]): string {
  return blocks
    .map((b) => (b.type === "text" ? textHtmlToPlain(b.html) : ""))
    .filter(Boolean)
    .join("\n");
}

/** Copies draft images into the article folder, numbered in reading order. */
async function placeImages(root: string, dir: string, blocks: Block[]): Promise<Block[]> {
  let count = 0;
  const placed: Block[] = [];
  for (const block of blocks) {
    if (block.type !== "image") {
      placed.push(block);
      continue;
    }
    if (count === 0) await mkdir(await join(dir, "images"), { recursive: true });
    count++;
    const name = `${String(count).padStart(3, "0")}.${block.file.split(".").pop()}`;
    await copyFile(await draftFilePath(root, block.file), await join(dir, "images", name));
    placed.push({ ...block, file: `images/${name}` });
  }
  return placed;
}

/** Writes article.html, meta.json and images into dir, and returns the saved form. */
async function writeArticleFiles(root: string, dir: string, input: ArticleMeta): Promise<ArticleMeta> {
  await mkdir(dir, { recursive: true });
  const meta: ArticleMeta = { ...input, blocks: await placeImages(root, dir, prepareBlocks(input.blocks)) };
  await writeTextFile(await join(dir, "article.html"), renderArticleHtml(meta));
  await writeTextFile(await join(dir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
  return meta;
}

function indexEntry(meta: ArticleMeta, folderPath: string) {
  return {
    title: meta.title,
    author: meta.author,
    publishedAt: meta.published_at,
    sourceUrl: meta.source_url,
    language: meta.language,
    readAt: meta.read_at,
    folderPath,
    body: plainBody(meta.blocks),
  };
}

async function refreshIndexHtml(root: string): Promise<void> {
  const { db } = await openIndex(root);
  const rows = await db.select<IndexRow[]>(
    "SELECT title, language, read_at, folder_path FROM articles ORDER BY read_at DESC, id DESC",
  );
  await writeTextFile(await join(root, "index.html"), renderIndexHtml(rows));
}

/** Removes the YYYY/MM/DD folders an article left behind, stopping at the first one still in use. */
async function pruneDateFolders(root: string, folderPath: string): Promise<void> {
  const parts = folderPath.split("/").slice(0, -1);
  for (; parts.length > 0; parts.pop()) {
    const dir = await join(root, ...parts);
    if ((await readDir(dir)).length > 0) return;
    await remove(dir);
  }
}

/** Writes the files first: they are the record, and the index can be rebuilt from them. */
export async function saveArticle(root: string, input: ArticleMeta): Promise<string> {
  const folderPath = await freeFolder(root, dateFolder(input.read_at), folderNameFromTitle(input.title));
  const meta = await writeArticleFiles(root, await articleDir(root, folderPath), input);
  const { url } = await openIndex(root);
  await invoke("index_insert", { db: url, entry: indexEntry(meta, folderPath) });
  await refreshIndexHtml(root);
  return folderPath;
}

/**
 * Replaces an article without risking the original: the new version is finished in a
 * staging folder, swapped in, and the old one is kept until the index has accepted the change.
 */
export async function updateArticle(root: string, id: number, oldPath: string, input: ArticleMeta): Promise<string> {
  const work = await join(root, WORK_FOLDER);
  const stamp = crypto.randomUUID();
  const staging = await join(work, `staging-${stamp}`);
  const replaced = await join(work, `replaced-${stamp}`);
  const oldDir = await articleDir(root, oldPath);

  const previous = await readArticleMeta(root, oldPath);
  const name = folderNameFromTitle(input.title);
  const keepsPlace = previous.read_at === input.read_at && folderNameFromTitle(previous.title) === name;
  const newPath = keepsPlace ? oldPath : await freeFolder(root, dateFolder(input.read_at), name);
  const newDir = await articleDir(root, newPath);

  let meta: ArticleMeta;
  try {
    meta = await writeArticleFiles(root, staging, input);
  } catch (e) {
    if (await exists(staging)) await remove(staging, { recursive: true });
    throw e;
  }

  await rename(oldDir, replaced);
  try {
    await mkdir(await join(root, ...newPath.split("/").slice(0, -1)), { recursive: true });
    await rename(staging, newDir);
    const { url } = await openIndex(root);
    await invoke("index_update", { db: url, id, entry: indexEntry(meta, newPath) });
  } catch (e) {
    if (await exists(newDir)) await rename(newDir, staging);
    await rename(replaced, oldDir);
    if (await exists(staging)) await remove(staging, { recursive: true });
    if (newPath !== oldPath) await pruneDateFolders(root, newPath);
    throw e;
  }

  await remove(replaced, { recursive: true });
  if (newPath !== oldPath) await pruneDateFolders(root, oldPath);
  await refreshIndexHtml(root);
  return newPath;
}

async function freeTrashName(trash: string, base: string): Promise<string> {
  for (let n = 1; ; n++) {
    const candidate = await join(trash, n === 1 ? base : `${base}_${n}`);
    if (!(await exists(candidate))) return candidate;
  }
}

/** Moves the folder to the trash so it can be recovered, and drops it from the index. */
export async function deleteArticle(root: string, id: number, folderPath: string): Promise<void> {
  const trash = await join(root, TRASH_FOLDER);
  await mkdir(trash, { recursive: true });
  const dir = await articleDir(root, folderPath);
  const name = folderPath.split("/").pop() as string;
  const date = folderPath.split("/").slice(0, 3).join("-");
  const target = await freeTrashName(trash, `${date}_${name}`);

  await rename(dir, target);
  try {
    const { url } = await openIndex(root);
    await invoke("index_delete", { db: url, id });
  } catch (e) {
    await rename(target, dir);
    throw e;
  }
  await pruneDateFolders(root, folderPath);
  await refreshIndexHtml(root);
}

async function subfolders(dir: string, namePattern: RegExp): Promise<string[]> {
  const entries = await readDir(dir);
  return entries.filter((e) => e.isDirectory && namePattern.test(e.name)).map((e) => e.name).sort();
}

export interface RebuildResult {
  count: number;
  /** Article folders whose meta.json could not be read; their files are left untouched. */
  skipped: string[];
}

/**
 * Recreates archive.db from the article folders. Only YYYY/MM/DD folders are read, which
 * leaves out _trash and _drafts. Every meta.json is read before the old database is removed,
 * and the file itself is replaced so this also recovers a database too damaged to open.
 */
export async function rebuildIndex(root: string): Promise<RebuildResult> {
  const entries: ReturnType<typeof indexEntry>[] = [];
  const skipped: string[] = [];
  for (const year of await subfolders(root, /^\d{4}$/)) {
    for (const month of await subfolders(await join(root, year), /^\d{2}$/)) {
      for (const day of await subfolders(await join(root, year, month), /^\d{2}$/)) {
        for (const name of await subfolders(await join(root, year, month, day), /./)) {
          const folderPath = `${year}/${month}/${day}/${name}`;
          try {
            entries.push(indexEntry(await readArticleMeta(root, folderPath), folderPath));
          } catch {
            skipped.push(folderPath);
          }
        }
      }
    }
  }

  const dbPath = await join(root, "archive.db");
  const url = `sqlite:${dbPath}`;
  // The pool may be open even if the file is unreadable, so close by name rather than trust `opened`.
  await Database.get(url).close().catch(() => {});
  opened = null;
  for (const suffix of ["", "-wal", "-shm"]) {
    if (await exists(dbPath + suffix)) await remove(dbPath + suffix);
  }
  await openIndex(root);
  await invoke("index_fill", { db: url, entries });
  await refreshIndexHtml(root);
  return { count: entries.length, skipped };
}

export async function countTrash(root: string): Promise<number> {
  const trash = await join(root, TRASH_FOLDER);
  return (await exists(trash)) ? (await readDir(trash)).length : 0;
}

export async function emptyTrash(root: string): Promise<void> {
  const trash = await join(root, TRASH_FOLDER);
  if (await exists(trash)) await remove(trash, { recursive: true });
}
