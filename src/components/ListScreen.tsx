import { useEffect, useState } from "react";
import { ArticleFilter, ArticlePage, ArticleRow, listArticlePage } from "../lib/archive";
import { ArticleRows } from "./ArticleRows";
import { LanguageFilter } from "./LanguageFilter";
import { Pager } from "./Pager";

const SEARCH_DELAY_MS = 250;

export const EMPTY_FILTER: ArticleFilter = { query: "", language: "", from: "", to: "", order: "newest" };

interface Props {
  root: string;
  filter: ArticleFilter;
  notice: string | null;
  error: string | null;
  onFilterChange: (filter: ArticleFilter) => void;
  /** Counted from 1. */
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onOpen: (row: ArticleRow) => void;
  onEdit: (row: ArticleRow) => void;
}

export function ListScreen({ root, filter, notice, error: outerError, onFilterChange, page, pageSize, onPageChange, onOpen, onEdit }: Props) {
  const [result, setResult] = useState<ArticlePage | null>(null);
  const [ownError, setError] = useState<string | null>(null);
  const error = ownError ?? outerError;

  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      listArticlePage(root, filter, page, pageSize)
        .then((next) => {
          if (!current) return;
          // The page can run past the end once articles are deleted or the page size grows.
          const last = Math.max(1, Math.ceil(next.total / pageSize));
          if (page > last) {
            onPageChange(last);
            return;
          }
          setResult(next);
          setError(null);
        })
        .catch((e) => current && setError(`목록을 읽지 못했습니다: ${e}`));
    }, SEARCH_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [root, filter, page, pageSize]);

  const set = (key: keyof ArticleFilter) => (e: { target: { value: string } }) =>
    onFilterChange({ ...filter, [key]: e.target.value });
  const showPage = (next: number) => {
    onPageChange(next);
    document.querySelector(".app-body")?.scrollTo(0, 0);
  };
  const rows = result?.rows;
  const total = result?.total ?? 0;
  const last = Math.max(1, Math.ceil(total / pageSize));
  const first = (page - 1) * pageSize + 1;
  const filtered = filter.query.trim() !== "" || filter.language !== "" || filter.from !== "" || filter.to !== "";

  return (
    <main className="list">
      <header>
        <h1>기사 목록</h1>
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
      {error && <p className="message error">{error}</p>}

      {rows && rows.length === 0 && (
        <p className="empty">{filtered ? "조건에 맞는 기사가 없습니다." : "아직 저장한 기사가 없습니다."}</p>
      )}
      {rows && rows.length > 0 && (
        <>
          <p className="count">
            {total}개{last > 1 && ` 중 ${first}–${first + rows.length - 1}`}
          </p>
          <ArticleRows rows={rows} onOpen={onOpen} onEdit={onEdit} />
          <Pager page={page} last={last} onPage={showPage} />
        </>
      )}
    </main>
  );
}
