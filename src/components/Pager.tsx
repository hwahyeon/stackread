/** Page numbers to show: the first, the last and two either side of the current one; null is a gap. */
function pageNumbers(page: number, last: number): (number | null)[] {
  const shown = new Set([1, last]);
  for (let n = page - 2; n <= page + 2; n++) if (n >= 1 && n <= last) shown.add(n);
  const sorted = [...shown].sort((a, b) => a - b);
  return sorted.flatMap((n, i) => (i > 0 && n - sorted[i - 1] > 1 ? [null, n] : [n]));
}

interface Props {
  page: number;
  last: number;
  onPage: (page: number) => void;
}

export function Pager({ page, last, onPage }: Props) {
  if (last <= 1) return null;
  return (
    <nav className="pager" aria-label="페이지">
      <button type="button" className="secondary" aria-label="이전 페이지" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ‹
      </button>
      {pageNumbers(page, last).map((n, i) =>
        n === null ? (
          <span key={`gap${i}`} className="pager-gap">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            className={n === page ? "secondary current" : "secondary"}
            aria-current={n === page ? "page" : undefined}
            onClick={() => onPage(n)}
          >
            {n}
          </button>
        ),
      )}
      <button type="button" className="secondary" aria-label="다음 페이지" disabled={page >= last} onClick={() => onPage(page + 1)}>
        ›
      </button>
    </nav>
  );
}
