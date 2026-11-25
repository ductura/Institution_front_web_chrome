import { describe, expect, it } from "vitest";

import { addStage, applyTemplate, planOutcome, type PlanCall } from "./plan-actions";

const DOC = "izmisljeni-rad-0001";
const PLAN = { milestones: [{ id: "00000000-0000-4000-8000-000000000e01", position: 1, title: "Izmišljena etapa", dueAt: null, submits: "current_version" }] };

function recorder(answer: Awaited<ReturnType<PlanCall>> | Error) {
  const sent: { id: string; params: unknown; body: unknown }[] = [];
  const call: PlanCall = async (id, input) => {
    sent.push({ id, params: input.params, body: input.body });
    if (answer instanceof Error) throw answer;
    return answer;
  };
  return { call, sent };
}

describe("plan writes (WEB-NF6-ETAPE, MK-6)", () => {
  it("names a result only from the server's answer", () => {
    expect(planOutcome({ ok: true, status: 201, body: PLAN })).toBe("saved");
    expect(planOutcome({ ok: true, status: 201, body: { nešto: 1 } })).toBe("unknown");
    expect(planOutcome({ ok: false, status: 401, code: "unauthorized" })).toBe("signedOut");
    expect(planOutcome({ ok: false, status: 403, code: "forbidden" })).toBe("forbidden");
    expect(planOutcome({ ok: false, status: 403, code: "origin_mismatch" })).toBe("unknown");
    expect(planOutcome({ ok: false, status: 404, code: "not_found" })).toBe("notFound");
    expect(planOutcome({ ok: false, status: 409, code: "conflict" })).toBe("conflict");
    expect(planOutcome({ ok: false, status: 422, code: "invalid_input" })).toBe("invalid");
    expect(planOutcome({ ok: false, status: 503, code: "unavailable" })).toBe("unknown");
    expect(planOutcome({ ok: false, status: 0 })).toBe("unknown");
  });

  it("adds a stage with the due date only when one is given", async () => {
    const { call, sent } = recorder({ ok: true, status: 201, body: PLAN });
    expect(await addStage(call, DOC, { title: "Nacrt", submits: "current_version" })).toBe("saved");
    expect(await addStage(call, DOC, { title: "Tema", submits: "topic_text", dueAt: "2026-12-01T10:00:00.000Z" })).toBe("saved");
    expect(sent).toEqual([
      { id: "work.milestone-plan.add.post", params: { documentId: DOC }, body: { title: "Nacrt", submits: "current_version" } },
      { id: "work.milestone-plan.add.post", params: { documentId: DOC }, body: { title: "Tema", dueAt: "2026-12-01T10:00:00.000Z", submits: "topic_text" } },
    ]);
  });

  it("applies the template without a body, and a thrown transport is unknown, never saved", async () => {
    const ok = recorder({ ok: true, status: 200, body: PLAN });
    expect(await applyTemplate(ok.call, DOC)).toBe("saved");
    expect(ok.sent).toEqual([{ id: "work.milestone-plan.apply-template.post", params: { documentId: DOC }, body: undefined }]);
    expect(await applyTemplate(recorder(new Error("veza prekinuta")).call, DOC)).toBe("unknown");
  });
});
