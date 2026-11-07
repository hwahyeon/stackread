import { KeyboardEvent, useId, useState } from "react";
import { cleanTags } from "../lib/types";

interface Props {
  tags: string[];
  /** Tags already used in other articles, offered while typing. */
  suggestions: string[];
  onChange: (tags: string[]) => void;
}

/** Enter or a comma adds what was typed; Backspace in an empty box removes the last tag. */
export function TagInput({ tags, suggestions, onChange }: Props) {
  const [text, setText] = useState("");
  const listId = useId();

  const add = (value: string) => {
    const next = cleanTags([...tags, ...value.split(",")]);
    if (next.length !== tags.length) onChange(next);
    setText("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      // Enter would otherwise submit the form and save the article.
      e.preventDefault();
      add(text);
    } else if (e.key === "Backspace" && text === "" && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div className="tag-input">
      {tags.map((tag) => (
        <span key={tag} className="tag">
          #{tag}
          <button
            type="button"
            className="tag-remove"
            aria-label={`${tag} 태그 빼기`}
            onClick={() => onChange(tags.filter((t) => t !== tag))}
          >
            ×
          </button>
        </span>
      ))}
      <input
        list={listId}
        aria-label="태그 추가"
        placeholder={tags.length ? "" : "태그를 입력하고 Enter"}
        value={text}
        onChange={(e) => (e.target.value.includes(",") ? add(e.target.value) : setText(e.target.value))}
        onKeyDown={onKeyDown}
        onBlur={() => text.trim() && add(text)}
      />
      <datalist id={listId}>
        {suggestions
          .filter((s) => !tags.includes(s))
          .map((s) => (
            <option key={s} value={s} />
          ))}
      </datalist>
    </div>
  );
}
