import { useEffect, useState } from "react";
import { DetailScreen } from "./components/DetailScreen";
import { EditorScreen } from "./components/EditorScreen";
import { EMPTY_FILTER, ListScreen } from "./components/ListScreen";
import { ArticleFilter, articleDir, readArticleMeta } from "./lib/archive";
import { createEditDraft, discardDraft, Draft, loadDraft } from "./lib/draft";
import { chooseRoot, loadRoot } from "./lib/settings";
import "./App.css";

type View =
  | { name: "list" }
  | { name: "editor"; key: string; draft: Draft | null; freshEdit: boolean; back: View }
  | { name: "detail"; id: number; folderPath: string };

const LIST: View = { name: "list" };

function editorView(draft: Draft | null, freshEdit = false, back: View = LIST): View {
  return { name: "editor", key: crypto.randomUUID(), draft, freshEdit, back };
}

/** Where a recovered draft belongs: an edit goes back to its article, a new one to the list. */
function viewForDraft(draft: Draft): View {
  const back: View = draft.editing ? { name: "detail", ...draft.editing } : LIST;
  return editorView(draft, false, back);
}

/** A found draft asks first; afterDiscard is what "버리기" continues with. */
interface DraftPrompt {
  draft: Draft;
  afterDiscard: () => void | Promise<void>;
}

export default function App() {
  const [root, setRoot] = useState<string | null | undefined>(undefined);
  const [view, setView] = useState<View>(LIST);
  const [prompt, setPrompt] = useState<DraftPrompt | null>(null);
  const [filter, setFilter] = useState<ArticleFilter>(EMPTY_FILTER);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRoot()
      .then(setRoot)
      .catch((e) => {
        setRoot(null);
        setError(`설정을 읽지 못했습니다: ${e}`);
      });
  }, []);

  useEffect(() => {
    if (!root) return;
    setView(LIST);
    setPrompt(null);
    loadDraft(root)
      .then((draft) => draft && setPrompt({ draft, afterDiscard: () => setView(LIST) }))
      .catch((e) => setError(`임시 저장본을 읽지 못했습니다: ${e}`));
  }, [root]);

  const pickRoot = async () => {
    try {
      const picked = await chooseRoot();
      if (picked) {
        setRoot(picked);
        setNotice(null);
        setError(null);
      }
    } catch (e) {
      setError(`폴더를 지정하지 못했습니다: ${e}`);
    }
  };

  /** Runs next unless a draft is waiting, in which case the user decides first. */
  const unlessDraftWaits = async (next: () => void | Promise<void>) => {
    if (!root) return;
    setNotice(null);
    setError(null);
    try {
      const draft = await loadDraft(root);
      if (draft) setPrompt({ draft, afterDiscard: next });
      else await next();
    } catch (e) {
      setError(`작업을 시작하지 못했습니다: ${e}`);
    }
  };

  const beginEdit = async (id: number, folderPath: string) => {
    if (!root) return;
    const meta = await readArticleMeta(root, folderPath);
    const dir = await articleDir(root, folderPath);
    const draft = await createEditDraft(root, dir, meta, { id, folderPath });
    setView(editorView(draft, true, { name: "detail", id, folderPath }));
  };

  const discardPrompted = async () => {
    if (!root || !prompt) return;
    try {
      await discardDraft(root);
      await prompt.afterDiscard();
      setPrompt(null);
    } catch (e) {
      setPrompt(null);
      setError(`작업을 이어가지 못했습니다: ${e}`);
    }
  };

  if (root === undefined) return null;

  if (root === null) {
    return (
      <main className="setup">
        <h1>Stackread</h1>
        <p>기사를 저장할 폴더를 골라 주세요. 글과 사진은 모두 이 폴더 안에 파일로 저장됩니다.</p>
        <button onClick={pickRoot}>폴더 선택</button>
        {error && <p className="message error">{error}</p>}
      </main>
    );
  }

  if (prompt) {
    return (
      <main className="setup">
        <h1>{prompt.draft.editing ? "수정 중이던 기사가 있습니다" : "작성 중이던 기사가 있습니다"}</h1>
        <p>{prompt.draft.fields.title || "(제목 없음)"} — 이어서 할까요?</p>
        <div className="actions">
          <button
            onClick={() => {
              setView(viewForDraft(prompt.draft));
              setPrompt(null);
            }}
          >
            이어서 하기
          </button>
          <button className="secondary" onClick={discardPrompted}>
            버리기
          </button>
        </div>
        {error && <p className="message error">{error}</p>}
      </main>
    );
  }

  if (view.name === "editor") {
    const editing = view.draft?.editing;
    return (
      <EditorScreen
        key={view.key}
        root={root}
        draft={view.draft}
        freshEdit={view.freshEdit}
        onSaved={(folder) => {
          if (editing) {
            setView({ name: "detail", id: editing.id, folderPath: folder });
          } else {
            setNotice(`저장했습니다: ${folder}`);
            setView(LIST);
          }
        }}
        onLeave={() => setView(view.back)}
      />
    );
  }

  if (view.name === "detail") {
    const { id, folderPath } = view;
    return (
      <DetailScreen
        key={folderPath}
        root={root}
        id={id}
        folderPath={folderPath}
        onBack={() => setView(LIST)}
        actionError={error}
        onEdit={() => unlessDraftWaits(() => beginEdit(id, folderPath))}
        onDeleted={() => {
          setNotice("삭제했습니다. 휴지통 폴더에서 되살릴 수 있습니다.");
          setView(LIST);
        }}
      />
    );
  }

  return (
    <ListScreen
      root={root}
      filter={filter}
      notice={notice}
      error={error}
      onFilterChange={setFilter}
      onOpen={(row) => {
        setNotice(null);
        setError(null);
        setView({ name: "detail", id: row.id, folderPath: row.folder_path });
      }}
      onNew={() => unlessDraftWaits(() => setView(editorView(null)))}
      onChangeRoot={pickRoot}
    />
  );
}
