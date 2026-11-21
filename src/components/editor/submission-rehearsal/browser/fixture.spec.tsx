import { Editor, EditorContent } from "@tiptap/react";
import { Button, Drawer } from "@ductura/ui";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "@ductura/ui/tokens.css";

import { createEditorExtensionsV2 } from "@/editor/schema";
import sample from "../../../../../docs/prototip/editor/samples/primjer-izmisljeni.json";
import { confirmationKey } from "../../../predaja/flow";
import { SubmissionRehearsal } from "../SubmissionRehearsal";

const assignmentId = "a8ee8f83-2949-4a99-b358-be77cd4938dd";
const sessionTag = "demo-student";
const block = (type: string, text: string) => ({ type, content: [{ type: "text", text }] });
const editor = new Editor({
  extensions: createEditorExtensionsV2(),
  content: {
    type: "doc",
    content: [
      ...sample.doc.content.filter(({ type }) => type !== "prikaz"),
      block("paragraph", "Procjena  opsega. [izvor]"),
      block("heading", "Sažetak"), block("paragraph", sample.abs),
      block("paragraph", `Ključne riječi: ${sample.kw}`),
      block("heading", "Summary"), block("paragraph", sample.sum),
    ],
  },
});

sessionStorage.setItem(confirmationKey(sessionTag, assignmentId), "1");

function Fixture() {
  const [drawer, setDrawer] = useState(false);
  const closeDrawer = () => setDrawer(false);
  const rehearsal = <SubmissionRehearsal editor={editor} assignmentId={assignmentId} sessionTag={sessionTag}
    enabledChecks={["fix"]} approval="pending" comments={[]} onJumpToDocument={closeDrawer} />;
  return <>
    {new URLSearchParams(window.location.search).has("drawer") ? <>
      <Button onClick={() => setDrawer(true)}>Otvori karticu Rad</Button>
      <Drawer open={drawer} side="right" title="Rad" onClose={closeDrawer}>{rehearsal}</Drawer>
    </> : rehearsal}
    <EditorContent editor={editor} />
  </>;
}

createRoot(document.getElementById("app")!).render(<Fixture />);
