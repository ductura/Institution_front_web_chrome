"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import type { Attrs, Node } from "@tiptap/pm/model";
import { NodeSelection } from "@tiptap/pm/state";

import { numberedHeadings } from "@/editor/chapter-numbers";
import { CrossReferenceDialog } from "../crossref/CrossReferenceDialog";
import { FootnoteDialog } from "./FootnoteDialog";
import { insertAcademicAtom, supportsAcademicAtoms, type AcademicAtom } from "./inline-atoms";

type Request = { kind: AcademicAtom; document: Node } & (
  | { mode: "insert"; from: number; to: number }
  | { mode: "read"; pos: number; node: Node }
);

/** The footnote dialog to open; the host passes its own (PIL-K-FUSNOTA), the old one is the default. */
export type FootnoteDialogComponent = typeof FootnoteDialog;

export function useV3EditorDialogs(
  editor: Editor | null,
  confirmedWorkSchemaVersion: number | undefined,
  Footnote: FootnoteDialogComponent = FootnoteDialog,
) {
  const [request, setRequest] = useState<Request | null>(null);
  const active = editor && !editor.isDestroyed && supportsAcademicAtoms(editor.schema, confirmedWorkSchemaVersion)
    ? editor : null;

  useEffect(() => {
    if (!active) return;
    const view = active.view;
    const inspect = (pos: number) => {
      const node = view.state.doc.nodeAt(pos);
      const kind = node?.type.name;
      if (!node || (kind !== "footnote" && kind !== "crossReference")) return false;
      setRequest({ kind, mode: "read", pos, node, document: view.state.doc });
      return true;
    };
    const click = (event: MouseEvent) => {
      const hit = view.posAtCoords(new DOMRect(event.clientX, event.clientY));
      if (hit && hit.inside >= 0 && inspect(hit.inside)) event.preventDefault();
    };
    const key = (event: KeyboardEvent) => {
      const { selection } = view.state;
      if (event.key === "Enter" && selection instanceof NodeSelection && inspect(selection.from)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    view.dom.addEventListener("click", click);
    view.dom.addEventListener("keydown", key, true);
    return () => {
      view.dom.removeEventListener("click", click);
      view.dom.removeEventListener("keydown", key, true);
    };
  }, [active]);

  const openInsert = active ? (kind: AcademicAtom) => {
    if (active.isDestroyed || !active.isEditable) return false;
    const { doc, selection } = active.state;
    setRequest({ kind, mode: "insert", document: doc, from: selection.from, to: selection.to });
    return true;
  } : undefined;

  if (!active || !request) return { openInsert, dialog: null };
  const close = () => setRequest(null);
  // Closing a footnote returns the caret to the text, so writing continues where it was left.
  const closeToEditor = () => {
    close();
    requestAnimationFrame(() => { if (!active.isDestroyed) active.view.focus(); });
  };
  const writable = () => !active.isDestroyed && active.isEditable && active.state.doc === request.document;
  const insert = (attrs: Attrs) => {
    if (request.mode !== "insert" || !writable()) return false;
    const { selection } = active.state;
    if (selection.from !== request.from || selection.to !== request.to) return false;
    const tr = insertAcademicAtom(active.state, confirmedWorkSchemaVersion, request.kind, attrs);
    if (!tr) return false;
    active.view.dispatch(tr);
    return active.state.doc !== request.document;
  };
  const change = (attrs?: Attrs) => {
    if (request.mode !== "read" || !writable()) return false;
    const { pos, node } = request;
    const tr = active.state.tr;
    if (attrs) tr.replaceWith(pos, pos + node.nodeSize, node.type.create(attrs));
    else tr.delete(pos, pos + node.nodeSize);
    active.view.dispatch(tr);
    return active.state.doc !== request.document;
  };

  let dialog: ReactNode = null;
  if (request.kind === "footnote") {
    if (request.mode === "insert") {
      dialog = <Footnote mode="insert" onSave={(text) => insert({ text })} onClose={closeToEditor} />;
    } else {
      let number = 0;
      request.document.nodesBetween(0, request.pos + 1, (node) => {
        if (node.type.name === "footnote") number++;
      });
      const text = request.node.attrs.text;
      if (typeof text === "string") {
        const note = { number, text };
        dialog = writable()
          ? <Footnote mode="edit" note={note} onSave={(next) => change({ text: next })} onRemove={() => change()} onClose={closeToEditor} />
          : <Footnote mode="read" note={note} onClose={closeToEditor} />;
      }
    }
  } else if (request.mode === "insert") {
    dialog = <CrossReferenceDialog mode="insert" document={active.state.doc}
      onInsert={(targetId) => insert({ targetId })} onClose={close} />;
  } else {
    const targetId = request.node.attrs.targetId;
    const follow = (id: string) => {
      if (active.isDestroyed) return;
      const heading = numberedHeadings(active.state.doc).find((candidate) => candidate.id === id);
      if (!heading) return;
      active.chain().setTextSelection(heading.pos + 1).scrollIntoView().run();
      close();
      requestAnimationFrame(() => { if (!active.isDestroyed) active.view.focus(); });
    };
    if (typeof targetId === "string") dialog = <CrossReferenceDialog mode="read" document={active.state.doc}
      targetId={targetId} onFollow={follow} onRemove={writable() ? () => change() : undefined} onClose={close} />;
  }
  return { openInsert, dialog };
}
