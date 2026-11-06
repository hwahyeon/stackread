import { fetch as httpFetch } from "@tauri-apps/plugin-http";

const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};

export function mimeFromExtension(extension: string): string {
  const lower = extension.toLowerCase();
  const found = Object.entries(MIME_TO_EXTENSION).find(([, ext]) => ext === lower);
  return found?.[0] ?? (lower === "jpeg" ? "image/jpeg" : "application/octet-stream");
}

function extensionFromName(name: string): string | undefined {
  const match = /\.([a-z0-9]{2,5})$/i.exec(name);
  if (!match) return undefined;
  const lower = match[1].toLowerCase();
  const normal = lower === "jpeg" ? "jpg" : lower;
  return Object.values(MIME_TO_EXTENSION).includes(normal) ? normal : undefined;
}

export interface ImageData {
  bytes: Uint8Array;
  extension: string;
  sourceUrl?: string;
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || extensionFromName(file.name) !== undefined;
}

export async function imageFromFile(file: File): Promise<ImageData> {
  return {
    bytes: new Uint8Array(await file.arrayBuffer()),
    extension: MIME_TO_EXTENSION[file.type.split(";")[0]] ?? extensionFromName(file.name) ?? "png",
  };
}

export async function imageFromUrl(address: string): Promise<ImageData> {
  const url = address.trim();
  if (url.startsWith("data:image/")) {
    const response = await window.fetch(url);
    const type = response.headers.get("content-type")?.split(";")[0] ?? "";
    return { bytes: new Uint8Array(await response.arrayBuffer()), extension: MIME_TO_EXTENSION[type] ?? "png" };
  }
  if (!/^https?:\/\//i.test(url)) throw new Error("http 또는 https로 시작하는 주소가 아닙니다");
  const response = await httpFetch(url);
  if (!response.ok) throw new Error(`서버 응답 ${response.status}`);
  const type = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
  const pathname = new URL(url).pathname;
  const extension = MIME_TO_EXTENSION[type] ?? extensionFromName(pathname);
  if (!extension) throw new Error(`사진이 아닌 응답입니다 (${type || "형식 없음"})`);
  return { bytes: new Uint8Array(await response.arrayBuffer()), extension, sourceUrl: url };
}

/** Whatever a paste or drop carried: a file first, then an image address. */
export async function imageFromTransfer(data: DataTransfer): Promise<ImageData | null> {
  const file = Array.from(data.files).find(isImageFile);
  if (file) return imageFromFile(file);
  const src = /<img[^>]+src=["']([^"']+)/i.exec(data.getData("text/html"))?.[1];
  const address = src ?? (data.getData("text/uri-list") || data.getData("text/plain")).trim();
  if (/^(https?:\/\/|data:image\/)\S+$/i.test(address)) return imageFromUrl(address.replace(/&amp;/g, "&"));
  return null;
}
