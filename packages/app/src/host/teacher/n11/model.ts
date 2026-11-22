// Pure rules of N-11 "Usporedba verzija" (WEB-2160; INVENTAR-nastavnik 3.11, PARITET N-11). One select
// "Usporedi s …": only submitted versions are offered, the newest is the current one and the default
// is the previous one. The counts are words, described without colour or threshold. No network call here.
import { formatDateTimeHr } from "../../../../../../src/lib/i18n/hr";
import { n11Messages as text } from "./messages.hr";

export type N11Version = { readonly kind: "checkpoint" | "submission"; readonly revision: number; readonly savedMinute: string };
export type N11Block = { readonly kind: "paragraph" | "bulletItem" | "quote" | "heading"; readonly level?: number; readonly change: "unchanged" | "removed" | "added"; readonly text: string };

export type N11Versions = { readonly kind: "ready"; readonly versions: readonly N11Version[] } | { readonly kind: "signedOut" | "unavailable" };
export type N11Compare = { readonly kind: "ready"; readonly blocks: readonly N11Block[] } | { readonly kind: "signedOut" | "notFound" | "unavailable" };

export interface N11Port {
  versions(documentId: string): Promise<N11Versions>;
  compare(documentId: string, from: number, to: number): Promise<N11Compare>;
}

export const unavailablePort: N11Port = {
  versions: async () => ({ kind: "unavailable" }),
  compare: async () => ({ kind: "unavailable" }),
};

export async function loadVersions(port: N11Port, documentId: string): Promise<N11Versions> {
  try {
    return await port.versions(documentId);
  } catch {
    return { kind: "unavailable" };
  }
}

export async function loadComparison(port: N11Port, documentId: string, from: number, to: number): Promise<N11Compare> {
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 1 || to <= from) return { kind: "unavailable" };
  try {
    return await port.compare(documentId, from, to);
  } catch {
    return { kind: "unavailable" };
  }
}

/** Submitted versions only, one per revision, newest first. */
export function submittedVersions(versions: readonly N11Version[]): readonly N11Version[] {
  const byRevision = new Map<number, N11Version>();
  for (const v of versions) if (v.kind === "submission") byRevision.set(v.revision, v);
  return [...byRevision.values()].sort((a, b) => b.revision - a.revision);
}

/** The "Usporedi s …" choices: every submitted version older than the current one. */
export function olderChoices(submitted: readonly N11Version[]): readonly N11Version[] {
  return submitted.slice(1);
}

/** Default: the previous submitted version. `null` while there is nothing to compare with. */
export function defaultFrom(submitted: readonly N11Version[]): number | null {
  return submitted[1]?.revision ?? null;
}

export const currentLine = (v: N11Version): string => text.current(formatDateTimeHr(v.savedMinute), v.revision);
export const optionLabel = (v: N11Version): string => text.option(formatDateTimeHr(v.savedMinute), v.revision);

const wordCount = (s: string): number => s.split(/\s+/).filter((w) => w !== "").length;

export function countWords(blocks: readonly N11Block[]): { readonly added: number; readonly removed: number } {
  let added = 0, removed = 0;
  for (const { change, text: t } of blocks) {
    if (change === "added") added += wordCount(t);
    if (change === "removed") removed += wordCount(t);
  }
  return { added, removed };
}

export const hasChanges = (blocks: readonly N11Block[]): boolean => blocks.some((b) => b.change !== "unchanged");

/** The live-work link is offered only when at least one version was submitted. */
export const hasSubmission = (versions: readonly N11Version[]): boolean => submittedVersions(versions).length > 0;
