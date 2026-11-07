import { useEffect, useState } from "react";
import { countTrash, emptyTrash, listTrash, rebuildIndex, TrashItem } from "../lib/archive";
import { languageLabel } from "../lib/languages";

interface Props {
  root: string;
  /** The index was rebuilt, so counts read from it may have changed. */
  onRebuilt: () => void;
}

export function MaintenanceSection({ root, onRebuilt }: Props) {
  const [trashCount, setTrashCount] = useState<number | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // null while the trash list is closed.
  const [trashItems, setTrashItems] = useState<TrashItem[] | null>(null);

  useEffect(() => {
    countTrash(root)
      .then(setTrashCount)
      .catch(() => setTrashCount(null));
  }, [root]);

  const rebuild = async () => {
    setRebuilding(true);
    setError(null);
    setNote(null);
    try {
      const { count, skipped } = await rebuildIndex(root);
      onRebuilt();
      setNote(
        `기사 ${count}개로 색인을 다시 만들었습니다.` +
          (skipped.length ? ` 읽지 못한 폴더 ${skipped.length}개: ${skipped.join(", ")}` : ""),
      );
    } catch (e) {
      setError(`색인을 다시 만들지 못했습니다: ${e}`);
    } finally {
      setRebuilding(false);
    }
  };

  const toggleTrash = async () => {
    if (trashItems) {
      setTrashItems(null);
      return;
    }
    setError(null);
    try {
      const items = await listTrash(root);
      setTrashItems(items);
      setTrashCount(items.length);
    } catch (e) {
      setError(`휴지통을 읽지 못했습니다: ${e}`);
    }
  };

  const clearTrash = async () => {
    if (!window.confirm(`휴지통의 기사 ${trashCount}개를 완전히 지울까요? 되돌릴 수 없습니다.`)) return;
    setError(null);
    setNote(null);
    try {
      await emptyTrash(root);
      setTrashCount(0);
      setTrashItems(null);
      setNote("휴지통을 비웠습니다.");
    } catch (e) {
      setError(`휴지통을 비우지 못했습니다: ${e}`);
    }
  };

  return (
    <>
      <h2>관리</h2>
      <ul className="manage-list">
        <li>
          <div>
            <div>색인 다시 만들기</div>
            <div className="manage-help">
              기사 폴더를 모두 다시 읽어 목록과 검색을 새로 만듭니다. 폴더를 직접 옮기거나 지웠을 때 사용하세요.
            </div>
          </div>
          <button type="button" className="secondary" disabled={rebuilding} onClick={rebuild}>
            {rebuilding ? "만드는 중..." : "다시 만들기"}
          </button>
        </li>
        <li>
          <div>
            <div>휴지통 {trashCount !== null && `(${trashCount}개)`}</div>
            <div className="manage-help">삭제한 기사가 모여 있습니다. 비우면 되돌릴 수 없습니다.</div>
          </div>
          <span className="manage-actions">
            <button type="button" className="secondary" disabled={!trashCount && !trashItems} onClick={toggleTrash}>
              {trashItems ? "닫기" : "보기"}
            </button>
            <button type="button" className="secondary" disabled={!trashCount} onClick={clearTrash}>
              비우기
            </button>
          </span>
        </li>
        {trashItems && (
          <li className="trash-items">
            {trashItems.length === 0 ? (
              <p className="manage-help">휴지통이 비어 있습니다.</p>
            ) : (
              <ul>
                {trashItems.map((item) => (
                  <li key={item.folder} title={item.folder}>
                    <span className="trash-title">{item.title || `(읽지 못한 폴더) ${item.folder}`}</span>
                    <span className="manage-help">{item.language && languageLabel(item.language)}</span>
                    <span className="manage-help">{item.read_at}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )}
      </ul>
      {note && <p className="message">{note}</p>}
      {error && <p className="message error">{error}</p>}
    </>
  );
}
