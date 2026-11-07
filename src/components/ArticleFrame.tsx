import { openUrl } from "@tauri-apps/plugin-opener";
import { SyntheticEvent, useEffect, useRef } from "react";

/** The frame can't see the app's theme setting, so the app's choice is copied onto its page. */
function copyTheme(frame: HTMLIFrameElement | null) {
  const page = frame?.contentDocument?.documentElement;
  if (!page) return;
  const theme = document.documentElement.dataset.theme;
  if (theme) page.dataset.theme = theme;
  else delete page.dataset.theme;
}

/**
 * Shows a rendered article page. allow-same-origin lets it read blob image URLs and lets
 * links be intercepted, so a source link opens in the browser instead of inside the frame.
 * Scripts stay off.
 */
export function ArticleFrame({ html }: { html: string }) {
  const frame = useRef<HTMLIFrameElement>(null);

  // Follows a theme switch made while the article is open.
  useEffect(() => {
    const observer = new MutationObserver(() => copyTheme(frame.current));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const onLoad = (e: SyntheticEvent<HTMLIFrameElement>) => {
    e.currentTarget.contentDocument?.addEventListener("click", (click) => {
      const link = (click.target as Element).closest?.("a");
      if (!link) return;
      click.preventDefault();
      if (/^https?:/i.test(link.href)) openUrl(link.href).catch(() => {});
    });
  };

  // Written into the page as well, so it doesn't first show in the other theme.
  const theme = document.documentElement.dataset.theme;
  const themed = theme ? html.replace(/<html\b/i, `<html data-theme="${theme}"`) : html;
  return (
    <iframe ref={frame} className="article-frame" title="기사" sandbox="allow-same-origin" srcDoc={themed} onLoad={onLoad} />
  );
}
