import { useEffect, useState } from "react";
import { prepareBlocks } from "../lib/archive";
import { draftImageUrl } from "../lib/draft";
import { renderArticleHtml } from "../lib/render";
import { ArticleMeta } from "../lib/types";
import { ArticleFrame } from "./ArticleFrame";

interface Props {
  root: string;
  meta: ArticleMeta;
  onClose: () => void;
}

/** Shows the same page article.html will contain. */
export function Preview({ root, meta, onClose }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    (async () => {
      const blocks = prepareBlocks(meta.blocks);
      const sources = new Map<string, string>();
      for (const b of blocks) if (b.type === "image") sources.set(b.file, await draftImageUrl(root, b.file));
      if (current) setHtml(renderArticleHtml({ ...meta, blocks }, (file) => sources.get(file) ?? file));
    })().catch((e) => current && setError(`미리보기를 만들지 못했습니다: ${e}`));
    return () => {
      current = false;
    };
  }, [root, meta]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="preview">
      <div className="preview-bar">
        <strong>미리보기</strong>
        <button type="button" className="secondary" onClick={onClose}>
          닫기
        </button>
      </div>
      {error && <p className="message error">{error}</p>}
      {html !== null && <ArticleFrame html={html} />}
    </div>
  );
}
