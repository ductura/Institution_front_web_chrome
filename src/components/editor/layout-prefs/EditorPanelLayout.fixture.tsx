import { Editor, EditorContent } from "@tiptap/react";
import { createRoot } from "react-dom/client";

import "@ductura/ui/tokens.css";
import { createEditorExtensions } from "@/editor";
import { messagesHr } from "@/lib/i18n/messages.hr";

import sample from "../../../../docs/prototip/editor/samples/primjer-izmisljeni.json";
import { EditorPanelLayout } from "./EditorPanelLayout";

const editor = new Editor({
  extensions: createEditorExtensions(),
  content: { ...sample.doc, content: sample.doc.content.flatMap((node) =>
    node.type === "heading" || node.type === "paragraph"
      ? [{ ...node, content: node.content?.filter(({ type }) => type === "text") }]
      : []) },
  editorProps: { attributes: { "aria-label": messagesHr.workspace.documentLabel } },
});

// The fixture exercises the real editor schema and selection without a session or a database.
export const useLocalEditor = () => editor;

createRoot(document.getElementById("root")!).render(
  <EditorPanelLayout title={sample.title} header={<header>Ductura</header>}
    tools={<div role="toolbar" aria-label="Alati za pisanje" />} status={<p>Lipovac</p>}
    leftSections={{ progress: <p>{sample.title}</p> }}
    rightSections={{ comments: <p>{sample.seeds[0]!.text}</p> }}>
    <EditorContent editor={editor} />
  </EditorPanelLayout>,
);
