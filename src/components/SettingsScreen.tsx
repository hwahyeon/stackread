import { FormEvent, useEffect, useState } from "react";
import { countByLanguage } from "../lib/archive";
import { addLanguage, languages, removeLanguage } from "../lib/languages";

interface Props {
  root: string;
  onLanguageRemoved: (code: string) => void;
  onBack: () => void;
}

export function SettingsScreen({ root, onLanguageRemoved, onBack }: Props) {
  const [list, setList] = useState(languages);
  const [counts, setCounts] = useState<Map<string, number> | null>(null);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    countByLanguage(root)
      .then(setCounts)
      .catch((e) => setError(`기사 수를 읽지 못해 언어를 삭제할 수 없습니다: ${e}`));
  }, [root]);

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
        <button type="button" className="secondary" onClick={onBack}>
          ← 목록
        </button>
      </header>

      <h2>언어</h2>
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
