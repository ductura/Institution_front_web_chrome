"use client";

// WEB-V21-STEM-LATEX-IZVOZ: the "LaTeX (rad.tex)" item of the Izvezi menu. The file is built in the browser from
// the work the editor holds (editor JSON -> canonical document v4 -> `buildTex`); nothing is sent to the server.
// The citation style is the institution's (read once, display only); where it cannot be read the item says so
// instead of exporting in a style the institution did not choose. Images stay out of the file (note in `latex.ts`).
import type { Editor } from "@tiptap/core";
import { useEffect, useState } from "react";

import {
  assignYearSuffixes, formatBibliographyEntry, formatCitationInText, sortBibliography,
} from "../../../../../editor-core/src/document/citation/format.ts";
import type { CitationStyle } from "../../../../../editor-core/src/document/citation/index.ts";
import type { DocumentSource } from "../../../../../editor-core/src/document/document/index.ts";
import { tiptapToCanonicalV4 } from "../../../../../editor-core/src/editor/interop-v4.ts";
import { citationStyleOf, DEFAULT_STYLE_ID } from "../citation-styles/catalog";
import { liveInstitutionStyle, type InstitutionStyleRead } from "../citation-styles/use-institution-style";
import { buildTex, TEX_FILE, type TexCitations } from "./latex";
import { stemHr as t } from "./messages.hr";

export type LatexMenuItem = { readonly id: "latex"; readonly label: string; readonly disabled: boolean; readonly hint?: string };

/** The work page's assignment id, from the address (the toolbar is not given it); null outside `/rad/<id>`. */
export function assignmentIdFromPath(pathname: string): string | null {
  const match = /^(?:\/app\/(?:web|chrome))?\/rad\/([^/]+)\/?$/u.exec(pathname);
  return match?.[1] ?? null;
}

/** The institution's style as TexCitations; the sources are cited as the editor's style formats them. */
export function texCitationsOf(style: CitationStyle): TexCitations {
  type Src = Parameters<typeof formatBibliographyEntry>[0];
  const as = (s: DocumentSource) => s as unknown as Src;
  return {
    inText: (source, locator) => formatCitationInText(as(source), style, locator),
    entry: (source) => formatBibliographyEntry(as(source), style),
    order: (sources) => sortBibliography(assignYearSuffixes(sources.map(as))) as unknown as readonly DocumentSource[],
  };
}

/** Where the style stands for the item: usable, still loading, or not readable (never silently another style). */
export type LatexStyle =
  | { readonly kind: "ready"; readonly style: CitationStyle }
  | { readonly kind: "loading" }
  | { readonly kind: "failed" };

export function latexStyleOf(read: InstitutionStyleRead | null): LatexStyle {
  if (read === null) return { kind: "ready", style: citationStyleOf(DEFAULT_STYLE_ID)! };
  if (read.kind === "loading") return { kind: "loading" };
  if (read.kind === "error") return { kind: "failed" };
  return { kind: "ready", style: read.style };
}

/** The style for the work at `assignmentId` (null: no assignment in the address, the default style is used). */
export function useLatexStyle(assignmentId: string | null): LatexStyle {
  const [read, setRead] = useState<{ for: string; read: InstitutionStyleRead } | null>(null);
  useEffect(() => {
    if (assignmentId === null) return;
    let live = true;
    void liveInstitutionStyle(assignmentId).then((r) => { if (live) setRead({ for: assignmentId, read: r }); }, () => { if (live) setRead({ for: assignmentId, read: { kind: "error" } }); });
    return () => { live = false; };
  }, [assignmentId]);
  if (assignmentId === null) return latexStyleOf(null);
  return latexStyleOf(read !== null && read.for === assignmentId ? read.read : { kind: "loading" });
}

const isV4 = (editor: Editor, schemaVersion: number | undefined): boolean =>
  schemaVersion === 4 && !!editor.schema.nodes.formula && !!editor.schema.nodes.codeBlock;

/** The item: off, with its reason, when the work is not in schema v4, the style is not ready or there is no editor. */
export function latexMenuItem(editor: Editor | null, schemaVersion: number | undefined, style: LatexStyle): LatexMenuItem {
  const off = (hint: string): LatexMenuItem => ({ id: "latex", label: t.latex.menuItem, disabled: true, hint });
  if (!editor || editor.isDestroyed) return off(t.latex.menuInvalid);
  if (!isV4(editor, schemaVersion)) return off(t.latex.menuNeedsV4);
  if (style.kind === "loading") return off(t.latex.menuStyleLoading);
  if (style.kind === "failed") return off(t.latex.menuStyleFailed);
  return { id: "latex", label: t.latex.menuItem, disabled: false };
}

export type LatexBuild = { readonly ok: true; readonly tex: string } | { readonly ok: false; readonly reason: string };

/** The `.tex` text of the work in the editor; the same work gives the same text. Refuses what is not a valid v4 work. */
export function buildLatexOf(editor: Editor | null, schemaVersion: number | undefined, style: LatexStyle, title = ""): LatexBuild {
  const item = latexMenuItem(editor, schemaVersion, style);
  if (item.disabled || !editor || style.kind !== "ready") return { ok: false, reason: item.hint ?? t.latex.menuInvalid };
  const candidate = tiptapToCanonicalV4(editor.getJSON());
  if (!candidate.ok) return { ok: false, reason: t.latex.menuInvalid };
  return { ok: true, tex: buildTex(candidate.doc, { title, citations: texCitationsOf(style.style) }) };
}

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  try { link.click(); } finally { setTimeout(() => URL.revokeObjectURL(url), 10_000); }
}

/** Downloads rad.tex; false (and no file) when the work cannot be built or the browser refuses. */
export function downloadLatex(editor: Editor | null, schemaVersion: number | undefined, style: LatexStyle, title = ""): boolean {
  const built = buildLatexOf(editor, schemaVersion, style, title);
  if (!built.ok) return false;
  try {
    saveBlob(new Blob([built.tex], { type: "application/x-tex;charset=utf-8" }), TEX_FILE);
    return true;
  } catch {
    return false;
  }
}
