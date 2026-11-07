import { closestCenter, DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ReactNode, useCallback, useState } from "react";
import { removeDraftImage } from "../lib/draft";
import { textHtmlToPlain } from "../lib/textHtml";
import { Block, ImageBlock } from "../lib/types";
import { ImageBlockEditor } from "./ImageBlockEditor";
import { TextBlockEditor } from "./TextBlockEditor";

export function newBlock(type: Block["type"]): Block {
  const id = crypto.randomUUID();
  return type === "text" ? { id, type, html: "" } : { id, type, file: "", caption: "" };
}

function hasContent(block: Block): boolean {
  return block.type === "text" ? textHtmlToPlain(block.html).trim() !== "" : block.file !== "" || block.caption !== "";
}

function AddMenu({ onPick }: { onPick: (type: Block["type"]) => void }) {
  return (
    <span className="add-menu">
      <button type="button" className="secondary" onClick={() => onPick("text")}>
        글
      </button>
      <button type="button" className="secondary" onClick={() => onPick("image")}>
        사진
      </button>
    </span>
  );
}

function SortableBlock({ id, onDelete, children }: { id: string; onDelete: () => void; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      className={isDragging ? "block dragging" : "block"}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="block-handle"
        aria-label="끌어서 순서 바꾸기"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <div className="block-body">{children}</div>
      <button type="button" className="block-delete" aria-label="블록 삭제" onClick={onDelete}>
        🗑
      </button>
    </div>
  );
}

interface Props {
  root: string;
  blocks: Block[];
  onChange: (update: (blocks: Block[]) => Block[]) => void;
}

export function BlockEditor({ root, blocks, onChange }: Props) {
  const [menuAt, setMenuAt] = useState<number | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const add = (index: number, type: Block["type"]) => {
    const block = newBlock(type);
    setFocusId(block.id);
    setMenuAt(null);
    onChange((list) => [...list.slice(0, index), block, ...list.slice(index)]);
  };

  const remove = (block: Block) => {
    if (hasContent(block) && !window.confirm("이 블록을 삭제할까요?")) return;
    onChange((list) => list.filter((b) => b.id !== block.id));
    if (block.type === "image" && block.file) removeDraftImage(root, block.file).catch(() => {});
  };

  const patch = useCallback(
    (id: string, fields: Partial<Block>) =>
      onChange((list) => list.map((b) => (b.id === id ? ({ ...b, ...fields } as Block) : b))),
    [onChange],
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onChange((list) =>
      arrayMove(
        list,
        list.findIndex((b) => b.id === active.id),
        list.findIndex((b) => b.id === over.id),
      ),
    );
  };

  return (
    <div className="block-list">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {blocks.map((block, index) => (
            <div key={block.id}>
              <SortableBlock id={block.id} onDelete={() => remove(block)}>
                {block.type === "text" ? (
                  <TextBlockEditor
                    initialHtml={block.html}
                    autoFocus={block.id === focusId}
                    onChange={(html) => patch(block.id, { html })}
                  />
                ) : (
                  <ImageBlockEditor
                    block={block}
                    root={root}
                    autoFocus={block.id === focusId}
                    onChange={(fields: Partial<ImageBlock>) => patch(block.id, fields)}
                  />
                )}
              </SortableBlock>
              {index < blocks.length - 1 && (
                <div className={menuAt === index + 1 ? "block-gap open" : "block-gap"}>
                  {menuAt === index + 1 ? (
                    <AddMenu onPick={(type) => add(index + 1, type)} />
                  ) : (
                    <button type="button" aria-label="블록 추가" onClick={() => setMenuAt(index + 1)}>
                      +
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </SortableContext>
      </DndContext>
      <div className="block-add">
        <button type="button" className="secondary" onClick={() => add(blocks.length, "text")}>
          + 글 추가
        </button>
        <button type="button" className="secondary" onClick={() => add(blocks.length, "image")}>
          + 사진 추가
        </button>
      </div>
    </div>
  );
}
