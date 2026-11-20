import { Editor, EditorContent } from "@tiptap/react";
import { createRoot } from "react-dom/client";
import "@ductura/ui/tokens.css";

import { createEditorExtensionsV2 } from "@/editor/schema";
import type { LocalCall } from "@/client/submission";
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

const requirementsCall: LocalCall = async (id, input) => {
  if (id !== "student.assignment-requirements.get" || input.body !== undefined) throw new Error("Unexpected call");
  const response = await fetch(`/api/v1/student/assignments/${input.params.assignmentId}/requirements`, { method: "GET" });
  return response.ok
    ? { ok: true, status: response.status, body: await response.json() }
    : { ok: false, status: response.status, code: "unavailable" };
};

sessionStorage.setItem(confirmationKey(sessionTag, assignmentId), "1");
createRoot(document.getElementById("app")!).render(<>
  <SubmissionRehearsal editor={editor} assignmentId={assignmentId} sessionTag={sessionTag}
    requirementsCall={requirementsCall} enabledChecks={["fix"]} approval="pending" comments={[]} />
  <EditorContent editor={editor} />
</>);
