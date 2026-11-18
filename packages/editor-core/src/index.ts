/**
 * @ductura/editor-core: the editor core ported from Ductus (opcija C, Ductus#2028).
 *
 * The public surface grows one ported part at a time; every part keeps the
 * path it had under Ductus src/domain (here src/document/) or src/editor
 * (here src/editor/), so its relative imports stay as they were.
 */
export const EDITOR_CORE_PACKAGE = "@ductura/editor-core";

// Canonical document model (Ductus src/domain/document).
export * from "./document/document";
export * from "./document/document/revision-zero";
export * from "./document/document/snapshot";
export * from "./document/document/text-blocks";
export * from "./document/document/validate-sources";
// Bibliography derived from a document (Ductus src/domain/citation/bibliography).
export { deriveBibliography, formatCitation, type Bibliography, type BibliographyEntry } from "./document/citation";
// Protected content and the word diff (Ductus src/domain/diff).
export * from "./document/diff";
// Comment anchors, shares, revision requests (Ductus src/domain/collaboration).
export * from "./document/collaboration";
export * from "./document/collaboration/revision-input";
export * from "./document/collaboration/snapshot-hash";
