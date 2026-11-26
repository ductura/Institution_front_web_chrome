// WEB-V16-TEMA-STUDENT: the read of the work's thesis topic (`work.thesis-topic.get`), parsed by hand from the
// server's answer (a wrong shape is "unavailable", never "no topic"). A 404 is "notFound": another's work or a
// work without a mentorship, so the frame hides the section.
import type { createApi } from "../../../../../../src/client/api";
import type { SectionRead } from "../model";

export type Call = ReturnType<typeof createApi>;
export type TopicState = "none" | "proposed" | "approved" | "returned";
export type Version = { version: number; title: string; summary: string; proposedAt: string };
export type Decision = { version: number; decision: "approved" | "returned"; comment: string | null; decidedAt: string };
export type Topic = { state: TopicState; current: Version | null; decision: Decision | null; history: Version[] };

const STATES: readonly string[] = ["none", "proposed", "approved", "returned"];
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function parseVersion(v: unknown): Version | null {
  if (!isObj(v) || typeof v.version !== "number" || !Number.isInteger(v.version) || typeof v.title !== "string"
    || typeof v.summary !== "string" || typeof v.proposedAt !== "string") return null;
  return { version: v.version, title: v.title, summary: v.summary, proposedAt: v.proposedAt };
}

function parseDecision(v: unknown): Decision | null {
  if (!isObj(v) || typeof v.version !== "number" || (v.decision !== "approved" && v.decision !== "returned")
    || (v.comment !== null && typeof v.comment !== "string") || typeof v.decidedAt !== "string") return null;
  return { version: v.version, decision: v.decision, comment: v.comment, decidedAt: v.decidedAt };
}

export function parseTopic(v: unknown): Topic | null {
  if (!isObj(v) || typeof v.state !== "string" || !STATES.includes(v.state) || !Array.isArray(v.history)) return null;
  const current = v.current === null ? null : parseVersion(v.current);
  const decision = v.decision === null ? null : parseDecision(v.decision);
  const history = v.history.map(parseVersion);
  if ((v.current !== null && current === null) || (v.decision !== null && decision === null) || !history.every((h): h is Version => h !== null)) return null;
  // A state that needs a proposal without one is a malformed answer, not an empty topic.
  if (v.state !== "none" && current === null) return null;
  return { state: v.state as TopicState, current, decision, history };
}

type Answer = { ok: true; body: unknown } | { ok: false; status: number };

export async function readTopic(call: Call, documentId: string): Promise<SectionRead<Topic>> {
  const a = (await call("work.thesis-topic.get", { params: { documentId }, query: undefined, body: undefined })) as Answer;
  if (!a.ok) return a.status === 404 ? { kind: "notFound" } : { kind: "unavailable" };
  const topic = parseTopic(a.body);
  return topic === null ? { kind: "unavailable" } : { kind: "ready", value: topic };
}
