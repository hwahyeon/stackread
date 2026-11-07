import { ThemeSwitch } from "./ThemeSwitch";

export type NavTarget = "list" | "calendar" | "settings" | "new";

const LINKS: { target: Exclude<NavTarget, "new">; label: string }[] = [
  { target: "list", label: "목록" },
  { target: "calendar", label: "달력" },
  { target: "settings", label: "설정" },
];

interface Props {
  active: NavTarget | null;
  canGoBack: boolean;
  onBack: () => void;
  onGo: (target: NavTarget) => void;
}

export function NavBar({ active, canGoBack, onBack, onGo }: Props) {
  return (
    <nav className="navbar">
      <button type="button" className="nav-back" aria-label="뒤로" title="뒤로 (Alt+←)" disabled={!canGoBack} onClick={onBack}>
        ←
      </button>
      <button type="button" className="brand" onClick={() => onGo("list")}>
        Stackread
      </button>
      <div className="nav-links">
        {LINKS.map(({ target, label }) => (
          <button
            key={target}
            type="button"
            className={active === target ? "nav-link active" : "nav-link"}
            aria-current={active === target ? "page" : undefined}
            onClick={() => onGo(target)}
          >
            {label}
          </button>
        ))}
      </div>
      <ThemeSwitch />
      <button type="button" className="nav-new" disabled={active === "new"} onClick={() => onGo("new")}>
        + 새 기사
      </button>
    </nav>
  );
}
