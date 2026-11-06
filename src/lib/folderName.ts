const MAX_LENGTH = 80;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/** Keeps the title as written, changing only what Windows cannot use in a folder name. */
export function folderNameFromTitle(title: string): string {
  const replaced = title.normalize("NFC").replace(/[\\/:*?"<>|\x00-\x1f]/g, "_");
  const cut = Array.from(replaced).slice(0, MAX_LENGTH).join("");
  const name = cut.trimStart().replace(/[. ]+$/, "");
  if (!name) return "untitled";
  return RESERVED.test(name) ? `${name}_` : name;
}
