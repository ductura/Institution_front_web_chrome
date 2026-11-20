"use client";

/**
 * The proofs panel on the editor page (WEB-1106): reads the sources and
 * citations of the open document and whether the student may write, and
 * wires the live routes of this work. Written with createElement, like
 * SidePanels, since it only passes props on.
 */

import { useEditorState } from "@tiptap/react";
import { createElement as h, useMemo } from "react";

import { useLocalEditor, useLocalSignedOut } from "../../LocalDocument";
import { documentCitations, documentSources, type CitationPlace, type ProofSource } from "./proof-sources";
import { liveDeps } from "./proofs-deps";
import { SourceProofsPanel } from "./SourceProofsPanel";

type Read = { sources: ProofSource[]; citations: CitationPlace[]; editable: boolean; key: string };
const EMPTY: Read = { sources: [], citations: [], editable: false, key: "" };

export function EditorSourceProofs({ assignmentId }: { assignmentId: string }) {
  const editor = useLocalEditor();
  const signedOut = useLocalSignedOut();
  const read = useEditorState({
    editor,
    selector: ({ editor: e }): Read => {
      if (e === null || e.isDestroyed) return EMPTY;
      const doc = e.state.doc;
      const sources = documentSources({ attrs: doc.attrs as Record<string, unknown> });
      const citations: CitationPlace[] = [];
      doc.descendants((node) => {
        if (node.type.name === "citation") citations.push(...documentCitations({ type: "citation", attrs: node.attrs as Record<string, unknown> }));
        return node.type.name !== "citation";
      });
      return { sources, citations, editable: e.isEditable, key: JSON.stringify([sources, citations, e.isEditable]) };
    },
    equalityFn: (a, b) => a?.key === b?.key,
  }) ?? EMPTY;
  const deps = useMemo(() => liveDeps(assignmentId), [assignmentId]);
  // After the session ends the panel shows nobody's proofs (as CommentPanel).
  if (signedOut) return null;
  return h(SourceProofsPanel, { sources: read.sources, citations: read.citations, editable: read.editable, deps });
}
