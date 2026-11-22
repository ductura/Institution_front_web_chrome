import { describe, expect, it, vi } from "vitest";

import { approveStage, deleteStage, readStages, renameStage, requestStageRevision } from "./stages-api";

const DOC = "doc-1";
const ID = "11111111-1111-4111-8111-111111111111";

describe("stages calls (WEB-1520)", () => {
  it("names the server operations with their params and bodies", async () => {
    const api = vi.fn(async () => ({ ok: true, status: 200, body: {} }));
    const call = api as never;
    await readStages(DOC, call);
    await approveStage(DOC, ID, undefined, call);
    await approveStage(DOC, ID, "Dobro", call);
    await requestStageRevision(DOC, ID, "Dopuni", "2026-12-01T10:00:00+01:00", call);
    await renameStage(DOC, ID, { title: "Novo" }, call);
    await deleteStage(DOC, ID, call);
    expect(api.mock.calls.map((c) => [(c as unknown[])[0], ((c as unknown[])[1] as { body: unknown }).body])).toEqual([
      ["work.milestone-states.get", undefined],
      ["work.milestones.approve.post", {}],
      ["work.milestones.approve.post", { message: "Dobro" }],
      ["work.milestones.request-revision.post", { comment: "Dopuni", revisionDueAt: "2026-12-01T10:00:00+01:00" }],
      ["work.milestones.details.patch", { title: "Novo" }],
      ["work.milestones.delete", undefined],
    ]);
  });
});
