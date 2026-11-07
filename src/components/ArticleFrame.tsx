import { openUrl } from "@tauri-apps/plugin-opener";
import { SyntheticEvent } from "react";

/**
 * Shows a rendered article page. allow-same-origin lets it read blob image URLs and lets
 * links be intercepted, so a source link opens in the browser instead of inside the frame.
 * Scripts stay off.
 */
export function ArticleFrame({ html }: { html: string }) {
  const onLoad = (e: SyntheticEvent<HTMLIFrameElement>) => {
    e.currentTarget.contentDocument?.addEventListener("click", (click) => {
      const link = (click.target as Element).closest?.("a");
      if (!link) return;
      click.preventDefault();
      if (/^https?:/i.test(link.href)) openUrl(link.href).catch(() => {});
    });
  };
  // The frame can't see the app's theme setting, so a fixed theme is written into its page.
  const theme = document.documentElement.dataset.theme;
  const themed = theme ? html.replace(/<html/i, `<html data-theme="${theme}"`) : html;
  return <iframe className="article-frame" title="기사" sandbox="allow-same-origin" srcDoc={themed} onLoad={onLoad} />;
}
