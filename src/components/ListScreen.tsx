import { useEffect, useState } from "react";
import { ArticleFilter, ArticleRow, countTrash, emptyTrash, listArticles, rebuildIndex } from "../lib/archive";
import { ArticleRows } from "./ArticleRows";
import { LanguageFilter } from "./LanguageFilter";

const SEARCH_DELAY_MS = 250;

export const EMPTY_FILTER: ArticleFilter = { query: "", language: "", from: "", to: "", order: "newest" };

interface Props {
  root: string;
  filter: ArticleFilter;
  notice: string | null;
  error: string | null;
  onFilterChange: (filter: ArticleFilter) => void;
  onOpen: (row: ArticleRow) => void;
  onNew: () => void;
  onCalendar: () => void;
  onSettings: () => void;
  onChangeRoot: () => void;
}

export function ListScreen({ root, filter, notice, error: outerError, onFilterChange, onOpen, onNew, onCalendar, onSettings, onChangeRoot }: Props) {
  const [rows, setRows] = useState<ArticleRow[] | null>(null);
  const [ownError, setError] = useState<string | null>(null);
  const error = ownError ?? outerError;
  const [trashCount, setTrashCount] = useState(0);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildNote, setRebuildNote] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      listArticles(root, filter)
        .then((result) => {
          if (!current) return;
          setRows(result);
          setError(null);
        })
        .catch((e) => current && setError(`목록을 읽지 못했습니다: ${e}`));
    }, SEARCH_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [root, filter, reloadKey]);

  useEffect(() => {
    countTrash(root)
      .then(setTrashCount)
      .catch(() => setTrashCount(0));
  }, [root]);

  const rebuild = async () => {
    setRebuilding(true);
    setError(null);
    setRebuildNote(null);
    try {
      const { count, skipped } = await rebuildIndex(root);
      setRebuildNote(
        `기사 ${count}개로 색인을 다시 만들었습니다.` +
          (skipped.length ? ` 읽지 못한 폴더 ${skipped.length}개: ${skipped.join(", ")}` : ""),
      );
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(`색인을 다시 만들지 못했습니다: ${e}`);
    } finally {
      setRebuilding(false);
    }
  };

  const clearTrash = async () => {
    if (!window.confirm(`휴지통의 기사 ${trashCount}개를 완전히 지울까요? 되돌릴 수 없습니다.`)) return;
    try {
      await emptyTrash(root);
      setTrashCount(0);
    } catch (e) {
      setError(`휴지통을 비우지 못했습니다: ${e}`);
    }
  };

  const set = (key: keyof ArticleFilter) => (e: { target: { value: string } }) =>
    onFilterChange({ ...filter, [key]: e.target.value });
  const filtered = filter.query.trim() !== "" || filter.language !== "" || filter.from !== "" || filter.to !== "";

  return (
    <main className="list">
      <header>
        <h1>Stackread</h1>
        <button type="button" className="link" onClick={onChangeRoot} title={root}>
          저장 폴더: {root}
        </button>
        <button type="button" className="secondary" onClick={onCalendar}>
          달력
        </button>
        <button type="button" className="secondary" onClick={onSettings}>
          설정
        </button>
        <button type="button" onClick={onNew}>
          + 새 기사
        </button>
      </header>

      <div className="filters">
        <input
          type="search"
          className="search"
          placeholder="제목·본문 검색"
          aria-label="제목·본문 검색"
          value={filter.query}
          onChange={set("query")}
        />
        <LanguageFilter value={filter.language} onChange={(language) => onFilterChange({ ...filter, language })} />
        <input type="date" aria-label="읽은 날짜 시작" value={filter.from} onChange={set("from")} />
        <span className="range-mark">~</span>
        <input type="date" aria-label="읽은 날짜 끝" value={filter.to} onChange={set("to")} />
        <select aria-label="정렬" value={filter.order} onChange={set("order")}>
          <option value="newest">최신순</option>
          <option value="oldest">오래된 순</option>
        </select>
      </div>

      {notice && <p className="message">{notice}</p>}
      {rebuildNote && <p className="message">{rebuildNote}</p>}
      {error && <p className="message error">{error}</p>}

      {rows && rows.length === 0 && (
        <p className="empty">{filtered ? "조건에 맞는 기사가 없습니다." : "아직 저장한 기사가 없습니다."}</p>
      )}
      {rows && rows.length > 0 && (
        <>
          <p className="count">{rows.length}개</p>
          <ArticleRows rows={rows} onOpen={onOpen} />
        </>
      )}
      <p className="maintenance">
        <button type="button" className="link" disabled={rebuilding} onClick={rebuild}>
          {rebuilding ? "색인을 만드는 중..." : "색인 다시 만들기"}
        </button>
        {trashCount > 0 && (
          <button type="button" className="link" onClick={clearTrash}>
            휴지통 비우기 ({trashCount}개)
          </button>
        )}
      </p>
    </main>
  );
}
