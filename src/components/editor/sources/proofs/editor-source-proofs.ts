"use client";

/**
 * The proofs panel on the editor page (WEB-1106): reads the sources and
 * citations of the open document and whether the student may write, and
 * wires the live routes of this work. Written with createElement, like
 * SidePanels, since it only passes props on.
 */

import { useEditorState } from "@tiptap/react";
import { createElement as h, Fragment, useMemo } from "react";
import { CITATION } from "@/editor";

import { StudentBibliographyHost } from "../../../../../packages/app/src/host/editor/bibliography/student/StudentBibliographyHost";
import { SourceNotebookHost } from "../../../../../packages/app/src/host/editor/source-notebook/SourceNotebookHost";
import { useLocalEditor, useLocalSignedOut } from "../../LocalDocument";
import { citationRange } from "../../citations/citation-document";
import { documentCitations, documentSources, type CitationPlace, type ProofSource } from "./proof-sources";
import { liveDeps } from "./proofs-deps";
import { SourceProofsPanel } from "./SourceProofsPanel";

type Read = { sources: ProofSource[]; citations: CitationPlace[]; editable: boolean; canInsert: boolean; key: string };
const EMPTY: Read = { sources: [], citations: [], editable: false, canInsert: false, key: "" };

export function EditorSourceProofs({ assignmentId, documentId }: { assignmentId: string; documentId: string }) {
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
      const canInsert = e.isEditable && citationRange(e.state) !== null;
      return { sources, citations, editable: e.isEditable, canInsert, key: JSON.stringify([sources, citations, e.isEditable, canInsert]) };
    },
    equalityFn: (a, b) => a?.key === b?.key,
  }) ?? EMPTY;
  const deps = useMemo(() => liveDeps(assignmentId), [assignmentId]);
  // The proofs and private notes belong to this session only.
  if (signedOut) return null;
  return h(Fragment, null,
    editor && !editor.isDestroyed && h(StudentBibliographyHost, { documentId, editor }),
    editor && !editor.isDestroyed && h(SourceNotebookHost, {
      documentId, editor, sources: read.sources, canInsert: read.canInsert, supported: Boolean(editor.schema.nodes[CITATION]),
    }),
    h(SourceProofsPanel, { sources: read.sources, citations: read.citations, editable: read.editable, deps }),
  );
}
