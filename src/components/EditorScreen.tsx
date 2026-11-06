import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { prepareBlocks, saveArticle, updateArticle } from "../lib/archive";
import { discardDraft, Draft, DraftFields, saveDraft } from "../lib/draft";
import { ArticleMeta, Block, LANGUAGES } from "../lib/types";
import { BlockEditor, newBlock } from "./BlockEditor";
import { Preview } from "./Preview";

const AUTOSAVE_DELAY_MS = 1500;

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function emptyFields(): DraftFields {
  return { title: "", author: "", publishedAt: "", sourceUrl: "", language: "en", readAt: today() };
}

function toMeta(fields: DraftFields, blocks: Block[]): ArticleMeta {
  return {
    title: fields.title.trim(),
    author: fields.author.trim(),
    published_at: fields.publishedAt,
    source_url: fields.sourceUrl.trim(),
    language: fields.language,
    read_at: fields.readAt,
    blocks,
  };
}

interface Props {
  root: string;
  draft: Draft | null;
  /** True when an edit was just opened, so its draft holds nothing the user wrote yet. */
  freshEdit: boolean;
  onSaved: (folder: string) => void;
  onLeave: () => void;
}

export function EditorScreen({ root, draft, freshEdit, onSaved, onLeave }: Props) {
  const editing = draft?.editing;
  const [fields, setFields] = useState<DraftFields>(() => draft?.fields ?? emptyFields());
  const [blocks, setBlocks] = useState<Block[]>(() => draft?.blocks ?? [newBlock("text")]);
  const [dirty, setDirty] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty || saving) return;
    const timer = setTimeout(() => {
      saveDraft(root, { fields, blocks, editing }).catch((e) => setError(`임시 저장에 실패했습니다: ${e}`));
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [root, dirty, saving, fields, blocks, editing]);

  const set = (key: keyof DraftFields) => (e: { target: { value: string } }) => {
    setFields((f) => ({ ...f, [key]: e.target.value }));
    setDirty(true);
  };

  const changeBlocks = useCallback((update: (list: Block[]) => Block[]) => {
    setBlocks(update);
    setDirty(true);
  }, []);

  /** Leaving keeps the work: the pending autosave would be cancelled, so write it now. */
  const leave = async () => {
    try {
      if (dirty) await saveDraft(root, { fields, blocks, editing });
      else if (freshEdit) await discardDraft(root);
      onLeave();
    } catch (e) {
      setError(`임시 저장에 실패했습니다: ${e}`);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (prepareBlocks(blocks).length === 0) {
      setError("본문을 입력해 주세요.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const meta = toMeta(fields, blocks);
      const folder = editing
        ? await updateArticle(root, editing.id, editing.folderPath, meta)
        : await saveArticle(root, meta);
      await discardDraft(root);
      onSaved(folder);
    } catch (err) {
      setError(`저장하지 못했습니다: ${err}`);
      setSaving(false);
    }
  };

  const closePreview = useCallback(() => setPreviewing(false), []);
  const previewMeta = useMemo(() => toMeta(fields, blocks), [fields, blocks]);

  return (
    <main className="editor">
      <header>
        <h1>{editing ? "기사 수정" : "새 기사"}</h1>
        <button type="button" className="secondary" onClick={leave}>
          {editing ? "← 돌아가기" : "← 목록"}
        </button>
      </header>
      <form onSubmit={submit}>
        <label className="wide">
          제목
          <input required value={fields.title} onChange={set("title")} />
        </label>
        <label>
          글쓴이
          <input value={fields.author} onChange={set("author")} />
        </label>
        <label>
          언어
          <select value={fields.language} onChange={set("language")}>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          기사 날짜
          <input type="date" value={fields.publishedAt} onChange={set("publishedAt")} />
        </label>
        <label>
          읽은 날짜
          <input type="date" required value={fields.readAt} onChange={set("readAt")} />
        </label>
        <label className="wide">
          출처 (URL)
          <input type="url" value={fields.sourceUrl} onChange={set("sourceUrl")} />
        </label>
        <div className="wide">
          <div className="field-label">본문</div>
          <BlockEditor root={root} blocks={blocks} onChange={changeBlocks} />
        </div>
        <div className="wide actions">
          <button type="submit" disabled={saving}>
            {saving ? "저장 중..." : "저장"}
          </button>
          <button type="button" className="secondary" onClick={() => setPreviewing(true)}>
            미리보기
          </button>
          {error && <p className="message error">{error}</p>}
        </div>
      </form>
      {previewing && <Preview root={root} meta={previewMeta} onClose={closePreview} />}
    </main>
  );
}
