import { FormEvent, ReactNode, useEffect, useState } from "react";
import { countByLanguage } from "../lib/archive";
import { addLanguage, languages, removeLanguage } from "../lib/languages";
import { MaintenanceSection } from "./MaintenanceSection";
import { applyTheme, currentTheme, saveTheme, Theme } from "../lib/settings";

const ICON = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

const THEMES: { value: Theme; label: string; icon: ReactNode }[] = [
  {
    value: "light",
    label: "밝게",
    icon: (
      <svg {...ICON}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "어둡게",
    icon: (
      <svg {...ICON}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    ),
  },
  {
    value: "system",
    label: "시스템 설정 따르기",
    icon: (
      <svg {...ICON}>
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
];

interface Props {
  root: string;
  onLanguageRemoved: (code: string) => void;
  onChangeRoot: () => void;
  rootError: string | null;
}

export function SettingsScreen({ root, onLanguageRemoved, onChangeRoot, rootError }: Props) {
  const [list, setList] = useState(languages);
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const [themeError, setThemeError] = useState<string | null>(null);

  const chooseTheme = async (next: Theme) => {
    applyTheme(next);
    setTheme(next);
    try {
      await saveTheme(next);
      setThemeError(null);
    } catch (e) {
      setThemeError(`화면 설정을 저장하지 못했습니다. 다음에 켤 때는 이전 설정으로 돌아갑니다: ${e}`);
    }
  };
  const [counts, setCounts] = useState<Map<string, number> | null>(null);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [countsKey, setCountsKey] = useState(0);

  useEffect(() => {
    countByLanguage(root)
      .then(setCounts)
      .catch((e) => setError(`기사 수를 읽지 못해 언어를 삭제할 수 없습니다: ${e}`));
  }, [root, countsKey]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await addLanguage(root, code, label);
      setList(languages());
      setCode("");
      setLabel("");
      setError(null);
    } catch (err) {
      setError(`언어를 추가하지 못했습니다: ${err instanceof Error ? err.message : err}`);
    }
  };

  const remove = async (target: string) => {
    try {
      await removeLanguage(root, target);
      setList(languages());
      setError(null);
      onLanguageRemoved(target);
    } catch (err) {
      setError(`언어를 삭제하지 못했습니다: ${err instanceof Error ? err.message : err}`);
    }
  };

  return (
    <main className="list settings">
      <header>
        <h1>설정</h1>
      </header>

      <h2>화면</h2>
      <div className="theme-choice" role="radiogroup" aria-label="화면 색">
        {THEMES.map(({ value, label, icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={theme === value}
            aria-label={label}
            title={label}
            className={theme === value ? "secondary selected" : "secondary"}
            onClick={() => chooseTheme(value)}
          >
            {icon}
          </button>
        ))}
      </div>
      {themeError && <p className="message error">{themeError}</p>}

      <h2>저장 폴더</h2>
      <div className="root-row">
        <span className="root-path">{root}</span>
        <button type="button" className="secondary" onClick={onChangeRoot}>
          바꾸기
        </button>
      </div>
      {rootError && <p className="message error">{rootError}</p>}

      <MaintenanceSection root={root} onIndexChanged={() => setCountsKey((k) => k + 1)} />

      <h2>기사 언어</h2>
      <ul className="language-list">
        {list.map((language) => {
          const count = counts?.get(language.code) ?? 0;
          return (
            <li key={language.code}>
              <span className="language-name">{language.label}</span>
              <span className="language-code">{language.code}</span>
              <span className="language-count">기사 {count}개</span>
              <button
                type="button"
                className="secondary"
                disabled={counts === null || count > 0 || list.length <= 1}
                title={count > 0 ? "이 언어로 저장한 기사가 있으면 삭제할 수 없습니다" : undefined}
                onClick={() => remove(language.code)}
              >
                삭제
              </button>
            </li>
          );
        })}
      </ul>

      <form className="language-form" onSubmit={add}>
        <label>
          이름
          <input required placeholder="Français" value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label>
          코드
          <input required placeholder="fr" value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        <button type="submit">추가</button>
      </form>

      <p className="message">
        이름은 화면에 표시되고, 코드는 기사에 언어 정보로 저장됩니다. 저장한 기사가 있는 언어는 삭제할 수 없습니다.
      </p>
      {error && <p className="message error">{error}</p>}
    </main>
  );
}
