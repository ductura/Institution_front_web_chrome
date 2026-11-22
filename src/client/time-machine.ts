/**
 * The student's reads for "Povijest verzija" (WEB-1504; plan M7.6).
 *
 * - work.versions.get: the saved versions of a work (checkpoints and submissions), read through createApi.
 * - work.compare.get: the difference between two versions, as the server's blocks of text.
 *
 * Neither read carries duration, pace or the size of a change into the result (PRODUCT §5): a version is
 * its kind, revision and saved minute, a comparison is its blocks. Restoring a version is not
 * here. Any answer outside the closed shape is `unavailable`.
 *
 * Both reads go through createApi with the generated contract (Faza 3, WEB-2007).
 */
import { createApi } from "./api";

export type TimeMachineVersion = { kind: "checkpoint" | "submission"; revision: number; savedMinute: string };
export type TimeMachineBlock = { kind: "paragraph" | "bulletItem" | "quote" | "heading"; level?: number; change: "unchanged" | "removed" | "added"; text: string };
export type VersionsResult = { kind: "ready"; versions: TimeMachineVersion[] } | { kind: "signedOut" | "unavailable" };
export type CompareResult = { kind: "ready"; blocks: TimeMachineBlock[] } | { kind: "signedOut" | "notFound" | "unavailable" };

export async function readTimeMachineVersions(documentId: string, api = createApi()): Promise<VersionsResult> {
  try {
    const result = await api("work.versions.get", { params: { documentId }, query: undefined, body: undefined });
    if (!result.ok) return { kind: result.status === 401 ? "signedOut" : "unavailable" };
    return { kind: "ready", versions: result.body.versions.map(({ kind, revision, savedMinute }) => ({ kind, revision, savedMinute })) };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function readTimeMachineComparison(documentId: string, from: number, to: number, api = createApi()): Promise<CompareResult> {
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 1 || to <= from) return { kind: "unavailable" };
  try {
    const result = await api("work.compare.get", { params: { documentId }, query: { from: String(from), to: String(to) }, body: undefined });
    if (!result.ok) {
      return { kind: result.status === 401 ? "signedOut" : result.status === 404 ? "notFound" : "unavailable" };
    }
    return {
      kind: "ready",
      blocks: result.body.blocks.map((block) => ({
        kind: block.kind, change: block.change, text: block.text, ...(block.kind === "heading" ? { level: block.level } : {}),
      })),
    };
  } catch {
    return { kind: "unavailable" };
  }
}
