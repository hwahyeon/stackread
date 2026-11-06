export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineHtml(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? "");
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const tag = (node as Element).tagName;
  if (tag === "BR") return "<br>";
  if (tag === "SCRIPT" || tag === "STYLE") return "";
  const inner = Array.from(node.childNodes).map(inlineHtml).join("");
  if (tag === "B" || tag === "STRONG") return `<b>${inner}</b>`;
  if (tag === "I" || tag === "EM") return `<i>${inner}</i>`;
  return inner;
}

/** Reduces a text block to the allowed form: p[data-indent], b, i, br. */
export function sanitizeTextHtml(html: string): string {
  const body = new DOMParser().parseFromString(html, "text/html").body;
  const paragraphs: string[] = [];
  let loose = "";
  const flushLoose = () => {
    if (loose.trim()) paragraphs.push(`<p>${loose}</p>`);
    loose = "";
  };
  for (const child of Array.from(body.childNodes)) {
    if ((child as Element).tagName !== "P") {
      loose += inlineHtml(child);
      continue;
    }
    flushLoose();
    const indent = Number((child as Element).getAttribute("data-indent"));
    const attr = indent >= 1 && indent <= 3 && Number.isInteger(indent) ? ` data-indent="${indent}"` : "";
    paragraphs.push(`<p${attr}>${inlineHtml(child)}</p>`);
  }
  flushLoose();
  return paragraphs.join("");
}

/** Tag-free text for the search index; paragraphs stay separated so words do not join. */
export function textHtmlToPlain(html: string): string {
  const body = new DOMParser().parseFromString(html, "text/html").body;
  return Array.from(body.children)
    .map((p) => {
      p.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
      return p.textContent ?? "";
    })
    .join("\n");
}
