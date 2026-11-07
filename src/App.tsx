import { useEffect, useRef, useState } from "react";
import { CalendarScreen, CalendarState, initialCalendar } from "./components/CalendarScreen";
import { DetailScreen } from "./components/DetailScreen";
import { EditorScreen } from "./components/EditorScreen";
import { EMPTY_FILTER, ListScreen } from "./components/ListScreen";
import { NavBar, NavTarget } from "./components/NavBar";
import { SettingsScreen } from "./components/SettingsScreen";
import { ArticleFilter, ArticleRow, articleDir, readArticleMeta } from "./lib/archive";
import { createEditDraft, discardDraft, Draft, loadDraft } from "./lib/draft";
import { loadLanguages } from "./lib/languages";
import { chooseRoot, loadRoot } from "./lib/settings";
import "./App.css";

type View =
  | { name: "list" }
  | { name: "calendar" }
  | { name: "settings" }
  | { name: "editor"; key: string; draft: Draft | null; freshEdit: boolean }
  | { name: "detail"; id: number; folderPath: string };

/** The current screen plus the screens "뒤로" returns to, oldest first. */
interface Nav {
  view: View;
  history: View[];
}

const LIST: View = { name: "list" };
const HOME: Nav = { view: LIST, history: [] };
const MAX_HISTORY = 50;

function editorView(draft: Draft | null, freshEdit = false): View {
  return { name: "editor", key: crypto.randomUUID(), draft, freshEdit };
}

function sameScreen(a: View, b: View): boolean {
  if (a.name === "detail" && b.name === "detail") return a.id === b.id;
  return a.name === b.name;
}

/** Shows view, dropping history entries that would make "뒤로" land on the same screen. */
function settle(view: View, history: View[]): Nav {
  const kept = [...history];
  while (kept.length > 0 && sameScreen(kept[kept.length - 1], view)) kept.pop();
  return { view, history: kept.slice(-MAX_HISTORY) };
}

/** History below the next screen; an editor is never kept, since its work lives in the draft. */
function below(cur: Nav): View[] {
  return cur.view.name === "editor" ? cur.history : [...cur.history, cur.view];
}

/** Opens a recovered draft; an edit gets its article underneath so "뒤로" lands there. */
function resumed(cur: Nav, draft: Draft): Nav {
  const history = below(cur);
  if (draft.editing) {
    const detail: View = { name: "detail", ...draft.editing };
    const last = history[history.length - 1];
    if (!last || !sameScreen(last, detail)) history.push(detail);
  }
  return settle(editorView(draft), history);
}

function activeTarget(view: View): NavTarget | null {
  if (view.name === "editor") return view.draft?.editing ? null : "new";
  return view.name === "detail" ? null : view.name;
}

/** A found draft asks first; afterDiscard is what "버리기" continues with. */
interface DraftPrompt {
  draft: Draft;
  afterDiscard: () => void | Promise<void>;
}

export default function App() {
  const [root, setRoot] = useState<string | null | undefined>(undefined);
  // The root whose language list is loaded; screens wait for it so they never show another root's list.
  const [languagesRoot, setLanguagesRoot] = useState<string | null>(null);
  const [nav, setNav] = useState<Nav>(HOME);
  const view = nav.view;
  // Set by the open editor: keeps its work before the app moves elsewhere; false means stay.
  const editorLeave = useRef<(() => Promise<boolean>) | null>(null);
  const [prompt, setPrompt] = useState<DraftPrompt | null>(null);
  const [filter, setFilter] = useState<ArticleFilter>(EMPTY_FILTER);
  const [calendar, setCalendar] = useState<CalendarState>(initialCalendar);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Drops the language filters, or only those set to `code`, once that language may be gone. */
  const clearLanguageFilters = (code?: string) => {
    const cleared = <T extends { language: string }>(state: T): T =>
      code === undefined || state.language === code ? { ...state, language: "" } : state;
    setFilter(cleared);
    setCalendar(cleared);
  };

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
    setNav(HOME);
    setPrompt(null);
    clearLanguageFilters();
    let current = true;
    loadLanguages(root)
      .catch((e) => setError(`언어 목록을 읽지 못해 기본 목록을 사용합니다: ${e}`))
      .finally(() => current && setLanguagesRoot(root));
    loadDraft(root)
      .then((draft) => draft && setPrompt({ draft, afterDiscard: () => setNav(HOME) }))
      .catch((e) => setError(`임시 저장본을 읽지 못했습니다: ${e}`));
    return () => {
      current = false;
    };
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

  const clearMessages = () => {
    setNotice(null);
    setError(null);
  };

  /** Runs next unless a draft is waiting, in which case the user decides first. */
  const unlessDraftWaits = async (next: () => void | Promise<void>) => {
    if (!root) return;
    clearMessages();
    try {
      const draft = await loadDraft(root);
      if (draft) setPrompt({ draft, afterDiscard: next });
      else await next();
    } catch (e) {
      setError(`작업을 시작하지 못했습니다: ${e}`);
    }
  };

  const leaveEditor = async () => view.name !== "editor" || !editorLeave.current || editorLeave.current();

  const go = async (next: View) => {
    if (!(await leaveEditor())) return;
    clearMessages();
    setNav((cur) => settle(next, below(cur)));
  };

  const goBack = async () => {
    if (prompt || nav.history.length === 0 || !(await leaveEditor())) return;
    clearMessages();
    setNav((cur) => {
      const last = cur.history[cur.history.length - 1];
      return last ? settle(last, cur.history.slice(0, -1)) : cur;
    });
  };

  const goTo = (target: NavTarget) => {
    if (target === "new") {
      if (view.name !== "editor") unlessDraftWaits(() => setNav((cur) => settle(editorView(null), below(cur))));
      return;
    }
    go({ name: target });
  };

  // Alt+← and the mouse's back button work like the "←" button.
  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        goBackRef.current();
      }
    };
    const onMouse = (e: MouseEvent) => {
      if (e.button === 3) {
        e.preventDefault();
        goBackRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mouseup", onMouse);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mouseup", onMouse);
    };
  }, []);

  const beginEdit = async (detail: Extract<View, { name: "detail" }>) => {
    if (!root) return;
    const { id, folderPath } = detail;
    const meta = await readArticleMeta(root, folderPath);
    const dir = await articleDir(root, folderPath);
    const draft = await createEditDraft(root, dir, meta, { id, folderPath });
    setNav((cur) => settle(editorView(draft, true), below(cur)));
  };

  const openArticle = (row: ArticleRow) => go({ name: "detail", id: row.id, folderPath: row.folder_path });

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

  if (root !== languagesRoot) return null;

  if (prompt) {
    return (
      <main className="setup">
        <h1>{prompt.draft.editing ? "수정 중이던 기사가 있습니다" : "작성 중이던 기사가 있습니다"}</h1>
        <p>{prompt.draft.fields.title || "(제목 없음)"} — 이어서 할까요?</p>
        <div className="actions">
          <button
            onClick={() => {
              const draft = prompt.draft;
              setNav((cur) => resumed(cur, draft));
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

  return (
    <div className="app">
      <NavBar active={activeTarget(view)} canGoBack={nav.history.length > 0} onBack={goBack} onGo={goTo} />
      <div className="app-body">{screen(root)}</div>
    </div>
  );

  function screen(root: string) {
    if (view.name === "editor") {
      const editing = view.draft?.editing;
      return (
        <EditorScreen
          key={view.key}
          root={root}
          draft={view.draft}
          freshEdit={view.freshEdit}
          leaveRef={editorLeave}
          onSaved={(folder) => {
            if (editing) {
              // The folder may have moved; older history entries for this article follow it.
              const moved = (v: View): View =>
                v.name === "detail" && v.id === editing.id ? { ...v, folderPath: folder } : v;
              setNav((cur) => settle({ name: "detail", id: editing.id, folderPath: folder }, cur.history.map(moved)));
            } else {
              setNav((cur) => settle(LIST, cur.history));
              setNotice(`저장했습니다: ${folder}`);
            }
          }}
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
          actionError={error}
          onEdit={() => unlessDraftWaits(() => beginEdit(view))}
          onDeleted={() => {
            setNav((cur) => settle(LIST, cur.history.filter((v) => !(v.name === "detail" && v.id === id))));
            setNotice("삭제했습니다. 휴지통 폴더에서 되살릴 수 있습니다.");
          }}
        />
      );
    }

    if (view.name === "settings") {
      return <SettingsScreen root={root} onLanguageRemoved={clearLanguageFilters} />;
    }

    if (view.name === "calendar") {
      return <CalendarScreen root={root} state={calendar} onChange={setCalendar} onOpen={openArticle} />;
    }

    return (
      <ListScreen
        root={root}
        filter={filter}
        notice={notice}
        error={error}
        onFilterChange={setFilter}
        onOpen={openArticle}
        onChangeRoot={pickRoot}
      />
    );
  }
}
