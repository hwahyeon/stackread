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

function isList(node: Node): boolean {
  const tag = (node as Element).tagName;
  return tag === "UL" || tag === "OL";
}

/** Paragraphs and lists in order; loose inline content between them becomes a paragraph. */
function blockHtml(nodes: Node[], allowIndent: boolean): string[] {
  const out: string[] = [];
  let loose = "";
  const flushLoose = () => {
    if (loose.trim()) out.push(`<p>${loose}</p>`);
    loose = "";
  };
  for (const child of nodes) {
    if (isList(child)) {
      flushLoose();
      const list = listHtml(child as Element);
      if (list) out.push(list);
    } else if ((child as Element).tagName === "P") {
      flushLoose();
      const indent = Number((child as Element).getAttribute("data-indent"));
      const attr =
        allowIndent && indent >= 1 && indent <= 3 && Number.isInteger(indent) ? ` data-indent="${indent}"` : "";
      out.push(`<p${attr}>${inlineHtml(child)}</p>`);
    } else {
      loose += inlineHtml(child);
    }
  }
  flushLoose();
  return out;
}

/** Keeps items with text; each item holds paragraphs and nested lists. */
function listHtml(list: Element): string {
  const tag = list.tagName.toLowerCase();
  const items = Array.from(list.children)
    .filter((li) => li.tagName === "LI")
    .map((li) => blockHtml(Array.from(li.childNodes), false).join(""))
    .filter((inner) => inner !== "")
    .map((inner) => `<li>${inner}</li>`);
  if (items.length === 0) return "";
  const start = Number(list.getAttribute("start") ?? 1);
  const attr = tag === "ol" && Number.isInteger(start) && start >= 0 && start !== 1 ? ` start="${start}"` : "";
  return `<${tag}${attr}>${items.join("")}</${tag}>`;
}

/** Reduces a text block to the allowed form: p[data-indent], ul, ol[start], li, b, i, br. */
export function sanitizeTextHtml(html: string): string {
  const body = new DOMParser().parseFromString(html, "text/html").body;
  return blockHtml(Array.from(body.childNodes), true).join("");
}

/** Tag-free text for the search index; paragraphs stay separated so words do not join. */
export function textHtmlToPlain(html: string): string {
  const body = new DOMParser().parseFromString(html, "text/html").body;
  // After sanitizing, all text sits in paragraphs, list items included.
  return Array.from(body.querySelectorAll("p"))
    .map((p) => {
      p.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
      return p.textContent ?? "";
    })
    .join("\n");
}
