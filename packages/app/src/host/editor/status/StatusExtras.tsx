"use client";

import { useEffect, useState } from "react";
import type { Node } from "@tiptap/pm/model";

import { ReviewPlaces } from "../../../../../../src/components/editor/citations/ReviewPlaces.tsx";
import { reviewPlaces } from "../../../../../../src/components/editor/citations/review-places.ts";
import { useLocalEditor } from "../../../../../../src/components/editor/LocalDocument.tsx";
import { useSelectedWords } from "../../../../../../src/components/editor/StatusLength.tsx";
import { beforeSubmission, useDeclarationGate } from "../../../../../../src/components/editor/submission-rehearsal/declaration-gate.ts";
import { createApi } from "../../../../../../src/client/api.ts";
import { readProofRequests, rehearsalSupplements, selectedLabel, type ProofsRead, type Supplements } from "./status-model.ts";
import { statusHostHr as t } from "./messages.hr.ts";

/**
 * The provider's editor, or null outside a LocalDocumentProvider. The top bar is drawn before the work
 * opens (outside the provider) and again inside it; useLocalEditor throws outside, after the same one
 * context read in both cases, so the order of hooks does not change.
 */
function useEditorIfOpen() {
  try {
    return useLocalEditor();
  } catch {
    return null;
  }
}

/** The open editor's document, read again after every transaction; null without an editor. */
function useDocument(): Node | null {
  const editor = useEditorIfOpen();
  const [doc, setDoc] = useState<Node | null>(null);
  useEffect(() => {
    if (!editor || editor.isDestroyed) return setDoc(null);
    const read = () => setDoc(editor.isDestroyed ? null : editor.state.doc);
    read();
    editor.on("transaction", read);
    return () => { editor.off("transaction", read); };
  }, [editor]);
  return doc;
}

/** "označeno: n riječi" and "n za provjeru" / "ništa za provjeru" at the end of the status bar (prototype app.js). */
export function StatusExtras() {
  const editor = useLocalEditor();
  const doc = useDocument();
  const selected = selectedLabel(useSelectedWords());
  if (doc === null) return null;
  return <>
    {selected && <span>{selected}</span>}
    {reviewPlaces(doc).length === 0 ? <span>{t.noHoles}</span> : <ReviewPlaces editor={editor} />}
  </>;
}

/** The rehearsal's extra rows, read from the open document. */
export function useRehearsalSupplements(): Supplements {
  return rehearsalSupplements(useDocument());
}

/** The mentor's requests for proofs of this assignment, read once per mount. */
function useProofRequests(assignmentId: string): ProofsRead {
  const [proofs, setProofs] = useState<ProofsRead>({ kind: "loading" });
  useEffect(() => {
    let live = true;
    void readProofRequests(createApi(), assignmentId).then((read) => { if (live) setProofs(read); });
    return () => { live = false; };
  }, [assignmentId]);
  return proofs;
}

/**
 * WEB-NUZ-PREDAJA-1 (P-16): the rehearsal's rows of one assignment, from the text and the server: the
 * mentor's proofs and the faculty's declaration form instead of a lasting "unavailable". The page passes
 * the hook it returns as `useSupplements`, once per mount, so the hook never changes under React.
 */
export function rehearsalSupplementsFor(assignmentId: string): () => Supplements {
  return function useAssignmentSupplements() {
    const doc = useDocument();
    const { gate } = useDeclarationGate(assignmentId);
    const proofs = useProofRequests(assignmentId);
    return rehearsalSupplements(doc, { gate, proofs });
  };
}

/**
 * WEB-NUZ-PREDAJA-1 (P-17): how many things are left before the submission, beside "Predaja rada" in the
 * top bar: the rehearsal's own "Što još fali" (the declaration from the server, the places left in the
 * text). Null while the text is not open, so the bar claims nothing.
 */
export function beforeSubmissionFor(assignmentId: string): () => number | null {
  return function useBeforeSubmissionCount() {
    const doc = useDocument();
    const { gate } = useDeclarationGate(assignmentId);
    if (doc === null || gate.kind === "loading") return null;
    return beforeSubmission(gate, reviewPlaces(doc).length).count;
  };
}
