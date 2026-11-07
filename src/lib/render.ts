import { escapeHtml } from "./textHtml";
import { languageLabel } from "./languages";
import { ArticleMeta } from "./types";

const ARTICLE_CSS = `
:root { color-scheme: light dark; --fg: #222; --muted: #6b6b6b; --bg: #fdfcf9; --rule: #dedbd2; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { --fg: #e4e2dc; --muted: #a09d95; --bg: #1c1b19; --rule: #3a3833; }
}
:root[data-theme="light"] { color-scheme: light; }
:root[data-theme="dark"] { color-scheme: dark; --fg: #e4e2dc; --muted: #a09d95; --bg: #1c1b19; --rule: #3a3833; }
body { margin: 0; background: var(--bg); color: var(--fg); }
main { max-width: 42rem; margin: 0 auto; padding: 3rem 1.25rem 5rem; font: 1.15rem/1.75 Georgia, "Malgun Gothic", serif; }
h1 { font-size: 2rem; line-height: 1.25; margin: 0 0 .75rem; overflow-wrap: anywhere; }
.meta { color: var(--muted); font-size: .9rem; line-height: 1.6; margin-bottom: 2.5rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--rule); }
.meta a { color: inherit; overflow-wrap: anywhere; }
p { margin: 0 0 1.1em; }
p[data-indent="1"] { margin-left: 2em; }
p[data-indent="2"] { margin-left: 4em; }
p[data-indent="3"] { margin-left: 6em; }
ul, ol { margin: 0 0 1.1em; padding-left: 1.6em; }
li > p { margin: 0 0 .3em; }
li > ul, li > ol { margin-bottom: .3em; }
figure { margin: 2em 0; }
img { display: block; max-width: 100%; height: auto; margin: 0 auto; }
figcaption { color: var(--muted); font-size: .85rem; line-height: 1.5; margin-top: .6em; text-align: center; }
`;

function sourceHtml(url: string): string {
  if (!url) return "";
  const safe = escapeHtml(url);
  return /^https?:\/\//i.test(url) ? `<a href="${safe}">${safe}</a>` : safe;
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

/**
 * A self-contained page: inline CSS, images referenced by relative path.
 * The preview passes imageSrc because draft images are not at their final path yet.
 */
export function renderArticleHtml(meta: ArticleMeta, imageSrc: (file: string) => string = encodePath): string {
  const facts = [
    meta.author && `글쓴이 ${escapeHtml(meta.author)}`,
    meta.published_at && `기사 날짜 ${escapeHtml(meta.published_at)}`,
    `읽은 날짜 ${escapeHtml(meta.read_at)}`,
    escapeHtml(languageLabel(meta.language)),
  ].filter(Boolean);
  const source = sourceHtml(meta.source_url);
  const tags = (meta.tags ?? []).map((t) => `#${escapeHtml(t)}`).join(" ");
  const body = meta.blocks
    .map((b) => {
      if (b.type === "text") return b.html;
      const caption = b.caption ? `<figcaption>${escapeHtml(b.caption)}</figcaption>` : "";
      return `<figure><img src="${escapeHtml(imageSrc(b.file))}" alt="${escapeHtml(b.caption)}">${caption}</figure>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="${escapeHtml(meta.language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(meta.title)}</title>
<style>${ARTICLE_CSS}</style>
</head>
<body>
<main>
<h1>${escapeHtml(meta.title)}</h1>
<div class="meta">${facts.join(" · ")}${source ? `<br>출처 ${source}` : ""}${tags ? `<br>태그 ${tags}` : ""}</div>
${body}
</main>
</body>
</html>
`;
}

export interface IndexRow {
  title: string;
  language: string;
  read_at: string;
  folder_path: string;
}

/** The emergency table of contents, used only when the app is unavailable. */
export function renderIndexHtml(rows: IndexRow[]): string {
  const items = rows
    .map(
      (r) =>
        `<li>${escapeHtml(r.read_at)} · <a href="${escapeHtml(encodePath(r.folder_path))}/article.html">${escapeHtml(r.title)}</a> · ${escapeHtml(languageLabel(r.language))}</li>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Stackread 목차</title>
<style>
:root { color-scheme: light dark; }
body { max-width: 48rem; margin: 2rem auto; padding: 0 1rem; font: 1rem/1.7 system-ui, "Malgun Gothic", sans-serif; }
ul { list-style: none; padding: 0; }
</style>
</head>
<body>
<h1>Stackread 목차</h1>
<ul>
${items}
</ul>
</body>
</html>
`;
}
