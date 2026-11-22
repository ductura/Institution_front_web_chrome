"use client";

// WEB-2126: what the left panel reads from the editor and from this device.
import type { Editor } from "@tiptap/core";
import { useCallback, useEffect, useState } from "react";

import { numberedHeadings, type NumberedHeading } from "../../../../../editor-core/src/outline/index.ts";
import { currentHeading } from "../../../../../editor-core/src/editor/outline";
import { useLocalEditor } from "../../../../../../src/components/editor/LocalDocument.tsx";
import { editorChapterWordCounts } from "../chapter-length/chapter-length";
import { readJson, storageKey, writeJson } from "./left-model";

export type Figure = { readonly kind: "table" | "figure" | "footnote"; readonly pos: number; readonly text: string };

export type WorkSnapshot = {
  readonly headings: readonly NumberedHeading[];
  readonly words: readonly number[];
  readonly total: number;
  readonly current: number;
  readonly figures: readonly Figure[];
  readonly selected: string;
};

const EMPTY: WorkSnapshot = { headings: [], words: [], total: 0, current: -1, figures: [], selected: "" };
const KINDS: Readonly<Record<string, Figure["kind"]>> = { table: "table", image: "figure", footnote: "footnote" };

/** What `select` reads from the editor, read again after every transaction and kept while it is equal. */
export function useEditorRead<T>(editor: Editor | null, select: (editor: Editor) => T, fallback: T): T {
  const read = () => (editor && !editor.isDestroyed ? select(editor) : fallback);
  const [value, setValue] = useState<T>(read);
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const update = () => {
      if (editor.isDestroyed) return;
      const next = select(editor);
      setValue((old) => (JSON.stringify(old) === JSON.stringify(next) ? old : next));
    };
    update();
    editor.on("transaction", update);
    return () => { editor.off("transaction", update); };
    // select is a stable module-level function at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);
  return value;
}

/** Headings, words per chapter, tables, figures and footnotes, as the editor holds them now. */
export function useWorkSnapshot(): WorkSnapshot {
  return useEditorRead(useLocalEditor(), snapshotOf, EMPTY);
}

function snapshotOf(instance: Editor): WorkSnapshot {
  {
    const { doc, selection } = instance.state;
    const headings = numberedHeadings(doc);
    const figures: Figure[] = [];
    doc.descendants((node: { type: { name: string }; textContent: string }, pos: number) => {
      const kind = KINDS[node.type.name];
      if (kind) figures.push({ kind, pos, text: node.textContent.slice(0, 80) });
    });
    const words = editorChapterWordCounts(doc);
    return {
      headings, words, total: words.reduce((sum, n) => sum + n, 0), figures,
      current: currentHeading(headings, selection.from),
      selected: selection.empty ? "" : doc.textBetween(selection.from, selection.to, "\n"),
    };
  }
}

function storage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

/** A value kept on this device only, per work. A failed write keeps the value for this visit. */
export function useDeviceValue<T>(kind: string, workId: string, parse: (raw: unknown) => T, fallback: T): [T, (next: T) => boolean] {
  const key = storageKey(kind, workId);
  const [value, setValue] = useState<T>(() => readJson(storage(), key, parse, fallback));
  const set = useCallback((next: T) => {
    setValue(next);
    return writeJson(storage(), key, next);
  }, [key]);
  return [value, set];
}
