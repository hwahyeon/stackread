import { ArticleRow } from "../lib/archive";
import { languageLabel } from "../lib/types";

interface Props {
  rows: ArticleRow[];
  onOpen: (row: ArticleRow) => void;
}

export function ArticleRows({ rows, onOpen }: Props) {
  return (
    <ul className="rows">
      {rows.map((row) => (
        <li key={row.id}>
          <button type="button" className="row" onClick={() => onOpen(row)}>
            <span className="row-title">{row.title}</span>
            <span className="row-author">{row.author}</span>
            <span className="row-language">{languageLabel(row.language)}</span>
            <span className="row-date">{row.read_at}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
