import { ReactNode, useState } from "react";
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

/** Light, dark or the system's colours; the choice is remembered for the next start. */
export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  const choose = (next: Theme) => {
    applyTheme(next);
    setTheme(next);
    // Not saving only means the next start uses the old choice; this session already shows the new one.
    saveTheme(next).catch((e) => console.warn("theme setting not saved", e));
  };

  return (
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
          onClick={() => choose(value)}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
