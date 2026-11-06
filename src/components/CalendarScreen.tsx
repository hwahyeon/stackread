import { useEffect, useState } from "react";
import { ArticleRow, countByDay, listArticles } from "../lib/archive";
import { LANGUAGES } from "../lib/types";
import { ArticleRows } from "./ArticleRows";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
// Rows of the yearly graph that carry a weekday label: too small to label all seven.
const LABELED_WEEKDAYS = [1, 3, 5];
const HEAT_LEVELS = [0, 1, 2, 3, 4];

export interface CalendarState {
  /** "YYYY-MM"; the yearly graph shows this month's year. */
  month: string;
  selected: string | null;
  language: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const dayString = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;
const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();
const weekdayOf = (year: number, month: number, day: number) => new Date(year, month - 1, day).getDay();

function today(): string {
  const now = new Date();
  return dayString(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function shiftMonth(month: string, delta: number): string {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(year, number - 1 + delta, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function initialCalendar(): CalendarState {
  return { month: today().slice(0, 7), selected: null, language: "" };
}

/** Fixed steps, so a day keeps its color when other days or the language filter change. */
const heatLevel = (count: number) => Math.min(count, 4);

function countLabel(day: string, count: number): string {
  return count ? `${day}: ${count}개` : `${day}: 없음`;
}

interface GraphProps {
  year: number;
  counts: Map<string, number>;
  selected: string | null;
  onSelect: (day: string) => void;
}

function YearGraph({ year, counts, selected, onSelect }: GraphProps) {
  const offset = weekdayOf(year, 1, 1);
  const cells: { day: string; column: number; row: number }[] = [];
  const months: { month: number; column: number }[] = [];
  for (let month = 1; month <= 12; month++) {
    for (let day = 1; day <= daysInMonth(year, month); day++) {
      const position = cells.length + offset;
      const column = Math.floor(position / 7);
      if (day === 1) months.push({ month, column });
      cells.push({ day: dayString(year, month, day), column, row: position % 7 });
    }
  }
  const weeks = cells[cells.length - 1].column + 1;

  return (
    <div className="year-graph" style={{ gridTemplateColumns: `1.2rem repeat(${weeks}, minmax(0, 1fr))` }}>
      {months.map(({ month, column }) => (
        <span key={month} className="graph-month" style={{ gridColumn: `${column + 2} / span 4`, gridRow: 1 }}>
          {month}월
        </span>
      ))}
      {LABELED_WEEKDAYS.map((weekday) => (
        <span key={weekday} className="graph-weekday" style={{ gridColumn: 1, gridRow: weekday + 2 }}>
          {WEEKDAYS[weekday]}
        </span>
      ))}
      {cells.map(({ day, column, row }) => {
        const count = counts.get(day) ?? 0;
        return (
          <button
            key={day}
            type="button"
            className={`heat-cell heat-${heatLevel(count)}${day === selected ? " selected" : ""}`}
            style={{ gridColumn: column + 2, gridRow: row + 2 }}
            title={countLabel(day, count)}
            aria-label={countLabel(day, count)}
            aria-pressed={day === selected}
            onClick={() => onSelect(day)}
          />
        );
      })}
    </div>
  );
}

interface MonthProps {
  month: string;
  counts: Map<string, number>;
  selected: string | null;
  onSelect: (day: string) => void;
}

function MonthGrid({ month, counts, selected, onSelect }: MonthProps) {
  const [year, number] = month.split("-").map(Number);
  const offset = weekdayOf(year, number, 1);
  const current = today();
  const days = Array.from({ length: daysInMonth(year, number) }, (_, i) => i + 1);

  return (
    <div className="month-grid">
      {WEEKDAYS.map((weekday) => (
        <span key={weekday} className="month-weekday">
          {weekday}
        </span>
      ))}
      {Array.from({ length: offset }, (_, i) => (
        <span key={i} />
      ))}
      {days.map((n) => {
        const day = dayString(year, number, n);
        const count = counts.get(day) ?? 0;
        return (
          <button
            key={day}
            type="button"
            className={`month-day${day === selected ? " selected" : ""}${day === current ? " today" : ""}`}
            aria-label={countLabel(day, count)}
            aria-pressed={day === selected}
            onClick={() => onSelect(day)}
          >
            <span>{n}</span>
            {count > 0 && <span className="month-count">{count}개</span>}
          </button>
        );
      })}
    </div>
  );
}

interface Props {
  root: string;
  state: CalendarState;
  onChange: (state: CalendarState) => void;
  onOpen: (row: ArticleRow) => void;
  onBack: () => void;
}

export function CalendarScreen({ root, state, onChange, onOpen, onBack }: Props) {
  const { month, selected, language } = state;
  const year = Number(month.slice(0, 4));
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [rows, setRows] = useState<ArticleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    countByDay(root, `${year}-01-01`, `${year}-12-31`, language)
      .then((result) => {
        if (!current) return;
        setCounts(result);
        setError(null);
      })
      .catch((e) => current && setError(`달력을 읽지 못했습니다: ${e}`));
    return () => {
      current = false;
    };
  }, [root, year, language]);

  useEffect(() => {
    setRows(null);
    if (!selected) return;
    let current = true;
    listArticles(root, { query: "", language, from: selected, to: selected, order: "newest" })
      .then((result) => current && setRows(result))
      .catch((e) => current && setError(`기사 목록을 읽지 못했습니다: ${e}`));
    return () => {
      current = false;
    };
  }, [root, selected, language]);

  const moveMonth = (delta: number) => onChange({ ...state, month: shiftMonth(month, delta), selected: null });
  const selectDay = (day: string) => onChange({ ...state, month: day.slice(0, 7), selected: day });
  const yearTotal = [...counts.values()].reduce((sum, count) => sum + count, 0);

  return (
    <main className="list calendar">
      <header>
        <h1>달력</h1>
        <select
          aria-label="언어"
          className="calendar-language"
          value={language}
          onChange={(e) => onChange({ ...state, language: e.target.value })}
        >
          <option value="">전체 언어</option>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
        <button type="button" className="secondary" onClick={onBack}>
          목록
        </button>
      </header>

      {error && <p className="message error">{error}</p>}

      <section>
        <div className="calendar-nav">
          <button type="button" className="secondary" aria-label="이전 해" onClick={() => moveMonth(-12)}>
            ‹
          </button>
          <strong>{year}년</strong>
          <button type="button" className="secondary" aria-label="다음 해" onClick={() => moveMonth(12)}>
            ›
          </button>
          <span className="count">{yearTotal}개 읽음</span>
        </div>
        <YearGraph year={year} counts={counts} selected={selected} onSelect={selectDay} />
        <div className="heat-legend" aria-hidden="true">
          {HEAT_LEVELS.map((level) => (
            <span key={level}>
              <i className={`heat-cell heat-${level}`} />
              {level === 4 ? "4개 이상" : `${level}개`}
            </span>
          ))}
        </div>
      </section>

      <section>
        <div className="calendar-nav">
          <button type="button" className="secondary" aria-label="이전 달" onClick={() => moveMonth(-1)}>
            ‹
          </button>
          <strong>{Number(month.slice(5))}월</strong>
          <button type="button" className="secondary" aria-label="다음 달" onClick={() => moveMonth(1)}>
            ›
          </button>
          <button
            type="button"
            className="link"
            onClick={() => onChange({ ...state, month: today().slice(0, 7), selected: today() })}
          >
            오늘
          </button>
        </div>
        <MonthGrid month={month} counts={counts} selected={selected} onSelect={selectDay} />
      </section>

      {selected && rows && (
        <section>
          <p className="count">
            {selected} · {rows.length}개
          </p>
          {rows.length > 0 ? (
            <ArticleRows rows={rows} onOpen={onOpen} />
          ) : (
            <p className="empty day-empty">이날 읽은 기사가 없습니다.</p>
          )}
        </section>
      )}
    </main>
  );
}
