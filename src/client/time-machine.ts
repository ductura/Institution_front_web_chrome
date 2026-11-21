/**
 * The student's reads for "Povijest verzija" (WEB-1504; plan M7.6).
 *
 * - work.versions.get: the saved versions of a work (checkpoints and submissions), read through createApi.
 * - work.compare.get: the difference between two versions.
 *
 * Neither read carries duration, pace or the size of a change into the result (PRODUCT §5): a version is
 * its kind, revision and saved minute, a comparison is its blocks of words. Restoring a version is not
 * here. Any answer outside the closed shape is `unavailable`.
 *
 * TODO(ugovor): work.compare.get is not in the generated contract of this base, so the caller passes its
 * transport (`CompareCall`); only tests call it, with invented answers. When the contract has it, it
 * moves to createApi and the shape below gives way to the contract's.
 */
import { createApi } from "./api";

export type TimeMachineVersion = { kind: "checkpoint" | "submission"; revision: number; savedMinute: string };
export type TimeMachineBlock = {
  op: "same" | "added" | "removed" | "changed";
  words: { op: "same" | "added" | "removed"; text: string }[];
};
export type VersionsResult = { kind: "ready"; versions: TimeMachineVersion[]; partial: boolean } | { kind: "signedOut" | "unavailable" };
export type CompareResult = { kind: "ready"; blocks: TimeMachineBlock[]; truncated: boolean } | { kind: "signedOut" | "notFound" | "unavailable" };

/** TODO(ugovor): the transport of a route that is not in the published contract yet. */
export type CompareCall = (
  id: "work.compare.get",
  input: { params: { documentId: string }; query: { from: string; to: string } },
) => Promise<{ ok: true; body: unknown } | { ok: false; status: number }>;

const OPS: ReadonlySet<unknown> = new Set(["same", "added", "removed"]);
const BLOCK_OPS: ReadonlySet<unknown> = new Set(["same", "added", "removed", "changed"]);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export async function readTimeMachineVersions(documentId: string, api = createApi()): Promise<VersionsResult> {
  try {
    const result = await api("work.versions.get", { params: { documentId }, query: undefined, body: undefined });
    if (!result.ok) return { kind: result.status === 401 ? "signedOut" : "unavailable" };
    // TODO(ugovor): this base's contract has no beforeRevision query for work.versions.get, so older pages
    // cannot be asked for; `partial` tells the page that older versions exist and are not listed.
    return {
      kind: "ready", partial: result.body.nextBeforeRevision !== null,
      versions: result.body.versions.map(({ kind, revision, savedMinute }) => ({ kind, revision, savedMinute })),
    };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function readTimeMachineComparison(
  call: CompareCall, documentId: string, from: number, to: number,
): Promise<CompareResult> {
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 1 || to <= from) return { kind: "unavailable" };
  try {
    const result = await call("work.compare.get", { params: { documentId }, query: { from: String(from), to: String(to) } });
    if (!result.ok) {
      return { kind: result.status === 401 ? "signedOut" : result.status === 404 ? "notFound" : "unavailable" };
    }
    const body = result.body;
    if (!isObject(body) || !Array.isArray(body.blocks)) return { kind: "unavailable" };
    const blocks: TimeMachineBlock[] = [];
    for (const block of body.blocks) {
      if (!isObject(block) || !BLOCK_OPS.has(block.op) || !Array.isArray(block.words)) return { kind: "unavailable" };
      const words: TimeMachineBlock["words"] = [];
      for (const word of block.words) {
        if (!isObject(word) || !OPS.has(word.op) || typeof word.text !== "string") return { kind: "unavailable" };
        words.push({ op: word.op as "same" | "added" | "removed", text: word.text });
      }
      blocks.push({ op: block.op as TimeMachineBlock["op"], words });
    }
    if (body.truncated !== undefined && typeof body.truncated !== "boolean") return { kind: "unavailable" };
    return { kind: "ready", blocks, truncated: body.truncated === true };
  } catch {
    return { kind: "unavailable" };
  }
}
