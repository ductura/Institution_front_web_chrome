// WEB-V16-TEMA-MENTOR: the read of the work's thesis topic, parsed by hand from the server's answer (a wrong
// shape is "unavailable", never "no topic yet"). A 404 is "notFound": the work is another's or has no
// mentorship, so the frame hides the section.
import type { createApi } from "../../../../../../src/client/api";
import type { SectionRead } from "../model";

export type Call = ReturnType<typeof createApi>;
export type TopicState = "none" | "proposed" | "approved" | "returned";
export type TopicVersion = { version: number; title: string; summary: string; proposedAt: string };
export type TopicDecision = { version: number; decision: "approved" | "returned"; comment: string | null; decidedAt: string };
export type TopicValue = { state: TopicState; current: TopicVersion | null; decision: TopicDecision | null; history: TopicVersion[] };

const STATES: readonly string[] = ["none", "proposed", "approved", "returned"];
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isVersionNo = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1;

export function parseVersion(v: unknown): TopicVersion | null {
  if (!isObj(v) || !isVersionNo(v.version) || typeof v.title !== "string" || typeof v.summary !== "string" || typeof v.proposedAt !== "string") return null;
  return { version: v.version, title: v.title, summary: v.summary, proposedAt: v.proposedAt };
}

export function parseDecision(v: unknown): TopicDecision | null {
  if (!isObj(v) || !isVersionNo(v.version) || (v.decision !== "approved" && v.decision !== "returned") || typeof v.decidedAt !== "string") return null;
  if (v.comment !== null && typeof v.comment !== "string") return null;
  return { version: v.version, decision: v.decision, comment: v.comment, decidedAt: v.decidedAt };
}

export function parseTopic(v: unknown): TopicValue | null {
  if (!isObj(v) || typeof v.state !== "string" || !STATES.includes(v.state) || !Array.isArray(v.history)) return null;
  const current = v.current === null ? null : parseVersion(v.current);
  const decision = v.decision === null ? null : parseDecision(v.decision);
  const history = v.history.map(parseVersion);
  if ((v.current !== null && current === null) || (v.decision !== null && decision === null) || !history.every((h): h is TopicVersion => h !== null)) return null;
  // A state with a proposal needs the proposal; a state without one must not claim any.
  if ((v.state === "none") !== (current === null)) return null;
  return { state: v.state as TopicState, current, decision, history };
}

type Answer = { ok: true; body: unknown } | { ok: false; status: number };

export async function readTopic(call: Call, documentId: string): Promise<SectionRead<TopicValue>> {
  const a = (await call("work.thesis-topic.get", { params: { documentId }, query: undefined, body: undefined })) as Answer;
  if (!a.ok) return a.status === 404 ? { kind: "notFound" } : { kind: "unavailable" };
  const value = parseTopic(a.body);
  return value === null ? { kind: "unavailable" } : { kind: "ready", value };
}
