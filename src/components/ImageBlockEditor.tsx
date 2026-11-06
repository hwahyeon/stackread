import { ClipboardEvent, DragEvent, useEffect, useRef, useState } from "react";
import { draftImageUrl, storeDraftImage } from "../lib/draft";
import { imageFromTransfer, imageFromUrl, ImageData } from "../lib/images";
import { ImageBlock } from "../lib/types";

interface Props {
  block: ImageBlock;
  root: string;
  autoFocus: boolean;
  onChange: (patch: Partial<ImageBlock>) => void;
}

export function ImageBlockEditor({ block, root, autoFocus, onChange }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const zone = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus && !block.file) zone.current?.focus();
    // Focus only when the block first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!block.file) return;
    let current = true;
    draftImageUrl(root, block.file)
      .then((url) => current && setSrc(url))
      .catch((e) => current && setError(`사진을 불러오지 못했습니다: ${e}`));
    return () => {
      current = false;
    };
  }, [root, block.file]);

  const accept = async (load: () => Promise<ImageData | null>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      const image = await load();
      if (!image) {
        setError(fallback);
        return;
      }
      const file = await storeDraftImage(root, image.bytes, image.extension);
      onChange({ file, source_url: image.sourceUrl });
    } catch (e) {
      setError(`사진을 가져오지 못했습니다 (${e instanceof Error ? e.message : e}). 브라우저에서 이미지를 복사해 붙여넣어 보세요.`);
    } finally {
      setBusy(false);
    }
  };

  const onPaste = (e: ClipboardEvent) => {
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    e.preventDefault();
    const data = e.clipboardData;
    accept(() => imageFromTransfer(data), "붙여넣은 내용에 사진이 없습니다.");
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer;
    accept(() => imageFromTransfer(data), "끌어다 놓은 내용에 사진이 없습니다.");
  };

  const download = () => {
    if (address.trim()) accept(() => imageFromUrl(address), "");
  };

  if (block.file) {
    return (
      <div className="image-block">
        {src ? <img src={src} alt={block.caption} /> : <div className="image-loading" />}
        <input
          className="caption"
          placeholder="캡션 (선택)"
          value={block.caption}
          onChange={(e) => onChange({ caption: e.target.value })}
        />
        {error && <p className="message error">{error}</p>}
      </div>
    );
  }

  return (
    <div
      ref={zone}
      className="image-drop"
      tabIndex={0}
      onPaste={onPaste}
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <p>{busy ? "사진을 가져오는 중..." : "여기를 누르고 Ctrl+V로 붙여넣거나, 사진 파일을 끌어다 놓으세요"}</p>
      <div className="image-address">
        <input
          type="url"
          placeholder="이미지 주소 (https://...)"
          value={address}
          disabled={busy}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              download();
            }
          }}
        />
        <button type="button" className="secondary" disabled={busy || !address.trim()} onClick={download}>
          내려받기
        </button>
      </div>
      {error && <p className="message error">{error}</p>}
    </div>
  );
}
