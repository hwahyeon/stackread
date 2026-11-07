import { Editor } from "@tiptap/core";
import Bold from "@tiptap/extension-bold";
import Document from "@tiptap/extension-document";
import HardBreak from "@tiptap/extension-hard-break";
import Italic from "@tiptap/extension-italic";
import { BulletList, ListItem, ListKeymap, OrderedList } from "@tiptap/extension-list";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { Placeholder, UndoRedo } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";

const MAX_INDENT = 3;

function clampIndent(value: number): number {
  return Math.min(MAX_INDENT, Math.max(0, Number.isInteger(value) ? value : 0));
}

function changeIndent(editor: Editor, delta: number): boolean {
  // In a list, Tab moves the item a level in or out instead. Always handled, so focus stays here.
  if (editor.isActive("listItem")) {
    if (delta > 0) editor.commands.sinkListItem("listItem");
    else editor.commands.liftListItem("listItem");
    return true;
  }
  const { state, view } = editor;
  const { from, to } = state.selection;
  const tr = state.tr;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name !== "paragraph") return;
    const indent = clampIndent(node.attrs.indent + delta);
    if (indent !== node.attrs.indent) tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent });
  });
  if (tr.docChanged) view.dispatch(tr);
  return true;
}

const IndentedParagraph = Paragraph.extend({
  addAttributes() {
    return {
      indent: {
        default: 0,
        parseHTML: (el) => clampIndent(Number(el.getAttribute("data-indent"))),
        renderHTML: (attrs) => (attrs.indent ? { "data-indent": attrs.indent } : {}),
      },
    };
  },
  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      Tab: () => changeIndent(this.editor, 1),
      "Shift-Tab": () => changeIndent(this.editor, -1),
    };
  },
});

// The schema is the paste filter: anything without a node or mark here (fonts, colors, links) is dropped.
const EXTENSIONS = [
  Document,
  IndentedParagraph,
  Text,
  Bold,
  Italic,
  HardBreak,
  // "- " or "* " at the start of a line begins a bulleted list, "1. " a numbered one.
  BulletList,
  OrderedList,
  ListItem,
  ListKeymap,
  UndoRedo,
  Placeholder.configure({ placeholder: "복사한 글을 붙여넣으세요" }),
];

interface Props {
  initialHtml: string;
  autoFocus: boolean;
  onChange: (html: string) => void;
}

export function TextBlockEditor({ initialHtml, autoFocus, onChange }: Props) {
  const editor = useEditor({
    extensions: EXTENSIONS,
    content: initialHtml,
    autofocus: autoFocus ? "end" : false,
    shouldRerenderOnTransaction: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });
  return <EditorContent editor={editor} className="text-block" />;
}
