import { LANGUAGES } from "../lib/types";

interface Props {
  /** A language code, or "" for all languages. */
  value: string;
  onChange: (value: string) => void;
}

export function LanguageFilter({ value, onChange }: Props) {
  return (
    <select aria-label="언어" className="language-filter" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">전체 언어</option>
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
