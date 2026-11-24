// An in-memory server for the student's assistant match notice (WEB-1230), invented data. Tests only. Moved here
// with its contract from the removed teacher/origin-map (PIL-P1-PODUDARANJE-KARTA); the notice is its only user.
import type { AssistantMatch, MatchCall, MatchState } from "./contract";

export const DOCUMENT = "demo-rad";

export const FAKE_MATCH: AssistantMatch = {
  segmentId: "s3",
  conversationId: "demo-razgovor-1",
  messageId: "0d1e2f3a-4b5c-4d6e-8f7a-9b0c1d2e3f40",
  attachedAt: "2026-11-18T09:40:00.000Z",
  words: 11,
};

export function fakeMatchServer(opts: { enabled?: boolean; matches?: readonly AssistantMatch[]; status?: number; throws?: boolean; body?: unknown } = {}) {
  const enabled = opts.enabled ?? true;
  let matches = enabled ? (opts.matches ?? [FAKE_MATCH]) : [];
  const calls: { id: string; params?: unknown; body?: unknown }[] = [];
  const call: MatchCall = async (id, input) => {
    calls.push({ id, params: input.params, body: input.body });
    if (opts.throws === true) throw new Error("offline");
    if (opts.status !== undefined && opts.status !== 200) return { ok: false as const, status: opts.status, code: "error" };
    if (opts.body !== undefined) return { ok: true as const, status: 200, body: opts.body };
    if (id === "work.assistant-match.get") return { ok: true as const, status: 200, body: { enabled, matches } satisfies MatchState };
    const segmentId = input.params?.segmentId;
    const found = matches.find((m) => m.segmentId === segmentId);
    if (found === undefined) return { ok: false as const, status: 404, code: "not_found" };
    const text = (input.body as { text: string }).text;
    const explanation = { text, at: "2026-11-18T10:00:00.000Z" };
    matches = matches.map((m) => (m === found ? { ...found, explanation } : m));
    return { ok: true as const, status: 201, body: explanation };
  };
  return { call, calls };
}
