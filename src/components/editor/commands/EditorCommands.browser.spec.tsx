import { createRoot } from "react-dom/client";
import { EditorContent, useEditor } from "@tiptap/react";
import { createEditorExtensions } from "@/editor";
import "@ductura/ui/tokens.css";

import EditorToolbarFor from "../EditorToolbarFor";
import { EditorCommandsFor } from "./EditorCommands";

function Example() {
  const editor = useEditor({
    extensions: createEditorExtensions(),
    content: "<h2>Uvod</h2><p>Maslina i maslina</p>",
    editorProps: { attributes: { role: "textbox", "aria-label": "Tekst rada", "aria-multiline": "true", class: "manuscript" } },
  });
  return <main><h1>Izmišljeni pokus</h1>
    <EditorCommandsFor editor={editor}><EditorToolbarFor editor={editor} /></EditorCommandsFor>
    <EditorContent editor={editor} />
  </main>;
}

createRoot(document.getElementById("root")!).render(<Example />);
