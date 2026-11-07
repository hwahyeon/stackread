import { join } from "@tauri-apps/api/path";
import { readFile } from "@tauri-apps/plugin-fs";
import { openPath } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { articleDir, deleteArticle, readArticleMeta } from "../lib/archive";
import { mimeFromExtension } from "../lib/images";
import { renderArticleHtml } from "../lib/render";
import { ArticleFrame } from "./ArticleFrame";

interface Props {
  root: string;
  id: number;
  folderPath: string;
  actionError: string | null;
  onEdit: () => void;
  onDeleted: () => void;
}

export function DetailScreen({ root, id, folderPath, actionError, onEdit, onDeleted }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  const [ownError, setError] = useState<string | null>(null);
  const error = ownError ?? actionError;

  useEffect(() => {
    let current = true;
    const urls: string[] = [];
    (async () => {
      const meta = await readArticleMeta(root, folderPath);
      const dir = await articleDir(root, folderPath);
      const sources = new Map<string, string>();
      for (const block of meta.blocks) {
        if (block.type !== "image") continue;
        const bytes = await readFile(await join(dir, ...block.file.split("/")));
        const type = mimeFromExtension(block.file.split(".").pop() ?? "");
        const url = URL.createObjectURL(new Blob([bytes], { type }));
        urls.push(url);
        sources.set(block.file, url);
      }
      if (current) setHtml(renderArticleHtml(meta, (file) => sources.get(file) ?? file));
    })().catch((e) => current && setError(`기사를 읽지 못했습니다: ${e}`));
    return () => {
      current = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [root, folderPath]);

  const openInBrowser = async () => {
    try {
      await openPath(await join(await articleDir(root, folderPath), "article.html"));
    } catch (e) {
      setError(`브라우저로 열지 못했습니다: ${e}`);
    }
  };

  const remove = async () => {
    if (!window.confirm("이 기사를 삭제할까요? 휴지통 폴더로 옮겨지므로 비우기 전까지는 되살릴 수 있습니다.")) return;
    try {
      await deleteArticle(root, id, folderPath);
      onDeleted();
    } catch (e) {
      setError(`삭제하지 못했습니다: ${e}`);
    }
  };

  return (
    <main className="detail">
      <div className="detail-bar">
        <span className="detail-actions">
          <button type="button" className="secondary" onClick={openInBrowser}>
            브라우저로 열기
          </button>
          <button type="button" className="secondary" onClick={onEdit}>
            수정
          </button>
          <button type="button" className="secondary" onClick={remove}>
            삭제
          </button>
        </span>
      </div>
      {error && <p className="message error">{error}</p>}
      {html !== null && <ArticleFrame html={html} />}
    </main>
  );
}
