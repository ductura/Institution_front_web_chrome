// F4-PRE-R04 (PD-1): the sections of the process summary that the summary route does not carry, each read
// from its own existing route through the shared client: versions (work.versions.get), the assistant
// (student.assignment-assistant.get, student.assistant-conversations.get), the declaration's blocks
// (student.declaration.get) and the provenance map (work.origin-composition.get, work.origin-segments.get).
// Every read fails alone: a failed one says "unavailable" for its section and changes nothing else.
import { createApi } from "../../../../../../../src/client/api.ts";
import { readTimeMachineVersions } from "../../../../../../../src/client/time-machine.ts";

import { summaryText as t } from "./messages.hr";
import { at } from "./panel-model";

type Call = ReturnType<typeof createApi>;

export type Read<T> = { readonly kind: "loading" } | { readonly kind: "unavailable" } | { readonly kind: "ready"; readonly value: T };

export type VersionsInfo = { readonly lines: readonly string[]; readonly more: boolean };
export type AssistantInfo = { readonly enabled: boolean; readonly lines: readonly string[] };
export type DeclarationBlocks = {
  readonly recorded: readonly string[];
  readonly student: readonly string[];
};
export type ProvenanceInfo = { readonly shares: readonly string[]; readonly marks: readonly string[] };

export type SummaryExtras = {
  readonly versions: Read<VersionsInfo>;
  readonly assistant: Read<AssistantInfo>;
  /** null: no declaration has been written yet. */
  readonly declaration: Read<DeclarationBlocks | null>;
  readonly provenance: Read<ProvenanceInfo>;
};

export const LOADING_EXTRAS: SummaryExtras = {
  versions: { kind: "loading" }, assistant: { kind: "loading" }, declaration: { kind: "loading" }, provenance: { kind: "loading" },
};

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
const UNAVAILABLE = { kind: "unavailable" } as const;

export async function readVersions(documentId: string, call: Call): Promise<Read<VersionsInfo>> {
  const read = await readTimeMachineVersions(documentId, call);
  if (read.kind !== "ready") return UNAVAILABLE;
  const lines = read.versions.map((v) => fill(t.versions.item, { n: v.revision, kind: t.versions.kinds[v.kind], at: at(v.savedMinute) }));
  return { kind: "ready", value: { lines, more: read.more === true } };
}

export async function readAssistant(assignmentId: string, call: Call): Promise<Read<AssistantInfo>> {
  try {
    const state = await call("student.assignment-assistant.get", { params: { assignmentId }, query: undefined, body: undefined });
    if (!state.ok) return UNAVAILABLE;
    if (!state.body.assistantEnabled) return { kind: "ready", value: { enabled: false, lines: [] } };
    const list = await call("student.assistant-conversations.get", { params: { assignmentId }, query: undefined, body: undefined });
    if (!list.ok) return UNAVAILABLE;
    const lines = list.body.conversations.map((c) => fill(t.assistant.conversation, {
      n: c.requestCount, at: at(c.lastActivityAt),
    }));
    return { kind: "ready", value: { enabled: true, lines } };
  } catch {
    return UNAVAILABLE;
  }
}

export async function readDeclarationBlocks(assignmentId: string, call: Call): Promise<Read<DeclarationBlocks | null>> {
  try {
    const result = await call("student.declaration.get", { params: { assignmentId }, query: undefined, body: undefined });
    if (!result.ok) return UNAVAILABLE;
    const { payload, draft } = result.body;
    const body = payload ?? draft;
    if (body === null) return { kind: "ready", value: null };
    const recorded = [fill(t.declaration.recordedRevision, { n: body.revision })];
    if (payload !== null) recorded.push(fill(t.declaration.recordedAt, { at: at(payload.confirmedAt) }));
    else recorded.push(t.declaration.recordedDraft);
    const student: string[] = [body.ownWork.confirmed ? t.declaration.ownWorkYes : t.declaration.ownWorkNo];
    student.push(body.humanHelp.received
      ? (body.humanHelp.entries.length === 0 ? t.declaration.helpYes : t.declaration.helpYes + " " + body.humanHelp.entries.map((e) => `${t.declaration.helpKinds[e.kind]}: ${e.text}`).join("; "))
      : t.declaration.helpNo);
    student.push(body.ai.use === "used" ? t.declaration.aiUsed : body.ai.use === "not_used" ? t.declaration.aiNotUsed : t.declaration.aiUnset);
    for (const tool of body.ai.declaredTools) student.push(`${tool.toolLabel} · ${tool.purposeText} · ${tool.phaseText}`);
    return { kind: "ready", value: { recorded, student } };
  } catch {
    return UNAVAILABLE;
  }
}

export async function readProvenance(documentId: string, call: Call): Promise<Read<ProvenanceInfo>> {
  try {
    const params = { documentId };
    const [composition, segments] = await Promise.all([
      call("work.origin-composition.get", { params, query: undefined, body: undefined }),
      call("work.origin-segments.get", { params, query: {}, body: undefined }),
    ]);
    if (!composition.ok || !segments.ok) return UNAVAILABLE;
    const shares = composition.body.parts.map((p) => fill(t.provenance.share, { kind: t.provenance.kinds[p.kind], percent: Math.round(p.percent) }));
    const marks = (Object.keys(t.provenance.kinds) as (keyof typeof t.provenance.kinds)[]).flatMap((kind) => {
      const n = segments.body.segments.filter((s) => s.kind === kind).length;
      return n === 0 ? [] : [fill(t.provenance.mark, { kind: t.provenance.kinds[kind], n })];
    });
    return { kind: "ready", value: { shares, marks } };
  } catch {
    return UNAVAILABLE;
  }
}

/** The four reads at once; each settles on its own, so one failure never hides another section. */
export function readExtras(assignmentId: string, documentId: string, call: Call, onPart: (extras: Partial<SummaryExtras>) => void): void {
  void readVersions(documentId, call).then((versions) => onPart({ versions }));
  void readAssistant(assignmentId, call).then((assistant) => onPart({ assistant }));
  void readDeclarationBlocks(assignmentId, call).then((declaration) => onPart({ declaration }));
  void readProvenance(documentId, call).then((provenance) => onPart({ provenance }));
}
