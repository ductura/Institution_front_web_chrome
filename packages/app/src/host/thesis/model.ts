// WEB-V16-KOSTUR: the pure rules of the shared "Završni rad" panel (student and mentor). A section brings its
// own read; the frame owns the four ways a read can end, and "unavailable" is never shown as "empty" (B-6).
import type { ComponentType } from "react";

export type ThesisRole = "student" | "mentor";

/** How one section's read ends. notFound is a work the server does not show (another's, or without a mentorship). */
export type SectionRead<T> =
  | { readonly kind: "ready"; readonly value: T }
  | { readonly kind: "empty" }
  | { readonly kind: "notFound" }
  | { readonly kind: "unavailable" };

export type SectionState<T = unknown> = { readonly kind: "loading" } | SectionRead<T>;

export type SectionViewProps<T> = {
  readonly documentId: string;
  readonly role: ThesisRole;
  readonly value: T;
  /** Reads the section again, e.g. after a write. */
  readonly reload: () => void;
};

/** What a `host/thesis/<name>/section.tsx` exports as `section`. */
export type ThesisSectionDef<T = unknown> = {
  readonly id: string;
  /** Lower first; equal orders keep the id order. */
  readonly order: number;
  readonly title: string;
  readonly read: (documentId: string, role: ThesisRole) => Promise<SectionRead<T>>;
  readonly View: ComponentType<SectionViewProps<T>>;
};

/** The sections in display order (order, then id); a repeated id keeps only its first. */
export function orderSections(sections: readonly ThesisSectionDef<never>[]): readonly ThesisSectionDef<never>[] {
  const seen = new Set<string>();
  return [...sections]
    .sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
}

/** A read that throws is "unavailable", never "empty". */
export async function readSafely<T>(run: () => Promise<SectionRead<T>>): Promise<SectionRead<T>> {
  try { return await run(); } catch { return { kind: "unavailable" }; }
}

/**
 * The panel shows only for a work in a mentorship. The server answers 404 for any other work, so when every
 * section has read as notFound the whole panel stays hidden; while any read is pending, or any section has
 * answered, it is shown. No sections at all: nothing to show.
 */
export function panelVisible(inMentorship: boolean, states: readonly SectionState[]): boolean {
  if (!inMentorship || states.length === 0) return false;
  return !states.every((s) => s.kind === "notFound");
}

/** Runtime check of a glob-loaded module: only a well-formed `section` export is registered. */
export function sectionOf(module: unknown): ThesisSectionDef<never> | null {
  const s = (module as { section?: Partial<ThesisSectionDef<never>> } | null)?.section;
  if (!s || typeof s.id !== "string" || s.id === "" || typeof s.title !== "string" || typeof s.order !== "number"
    || typeof s.read !== "function" || typeof s.View !== "function") return null;
  return s as ThesisSectionDef<never>;
}
