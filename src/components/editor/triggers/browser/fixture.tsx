import { Button } from "@ductura/ui";
import "@ductura/ui/tokens.css";
import { EditorContent, useEditor } from "@tiptap/react";
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { createEditorExtensions } from "../../../../../packages/editor-core/src/editor/schema";
import { EditorHelpDialogs, useEditorHelp, type EditorHelpView } from "../../help/EditorHelp";
import { EditorHelpMenu } from "../../help/EditorHelpMenu";
import { EditorNotices, type EditorNotice } from "../../help/EditorNotices";
import { TriggerPopover } from "../TriggerPopover";

const sources = [{ id: "demo", label: "Čavlović (2026)", title: "Izmišljena literatura", search: "Čavlović", notes: [{ id: "str", page: "14", text: "Izmišljena bilješka" }] }];

function Fixture() {
  const help = useEditorHelp();
  const [view, setView] = useState<EditorHelpView | null>(null);
  const [showOutline, setShowOutline] = useState(true);
  const editor = useEditor({ extensions: createEditorExtensions(""), editorProps: { attributes: { role: "textbox", "aria-multiline": "true", "aria-label": "Tekst rada" } } });
  return <main style={{ margin: 16 }}><h1>Izmišljeni rad</h1>
    <EditorHelpMenu onSelect={setView} />
    <EditorHelpDialogs view={view} onClose={() => setView(null)} help={help}
      notice={{ course: "Izmišljeni kolegij", title: "Izmišljeni rad", due: "1. prosinca", length: { min: 10, max: 20 }, instructions: <p>Izmišljena uputa.</p> }} />
    <Button onMouseDown={(event) => event.preventDefault()} onClick={() => editor?.setEditable(!editor.isEditable)}>Promijeni uređivanje</Button>
    <EditorNotices notices={[
      { kind: "offline", savingLocally: false },
      ...(showOutline ? [{ kind: "outline", resume: () => setShowOutline(false) } satisfies EditorNotice] : []),
    ]} />
    <section className="sheet" data-sheet-theme="light" aria-label="List rada">
      <EditorContent editor={editor} />
      <TriggerPopover editor={editor} sources={sources} actions={{ cite: (_id, page) => editor?.commands.insertContent(page ? `(Čavlović, 2026, ${page})` : "(Čavlović, 2026)"),
        addSource: () => setView("firstSentence") }} />
    </section>
  </main>;
}

createRoot(document.getElementById("root")!).render(<Fixture />);
