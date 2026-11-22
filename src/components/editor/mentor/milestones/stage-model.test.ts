import { describe, expect, it } from "vitest";

import { approvedCount, mayDecide, mayDelete, optionalText, stageDot } from "./stage-model";
import type { Stage } from "./stages-api";
import { stagesHr } from "./stages-messages.hr";

const stage = (over: Partial<Stage> = {}): Stage => ({
  id: "11111111-1111-4111-8111-111111111111", title: "Etapa 1", description: "", dueAt: null, state: "not_submitted",
  everSubmitted: false, submittedRevisionId: null, submittedAt: null, revisionComment: null, revisionDueAt: null,
  revisionRequestedAt: null, approvedAt: null, approvalMessage: null, ...over,
} as Stage);

describe("stage model (WEB-1520)", () => {
  it("maps every server state to one dot", () => {
    expect(stageDot(stage())).toBe("waiting");
    expect(stageDot(stage({ state: "submitted" }))).toBe("submitted");
    expect(stageDot(stage({ state: "revision_requested" }))).toBe("revision");
    expect(stageDot(stage({ state: "approved" }))).toBe("approved");
  });

  it("lets the mentor decide only on a submitted stage", () => {
    expect(mayDecide(stage({ state: "submitted" }))).toBe(true);
    for (const state of ["not_submitted", "revision_requested", "approved"] as const) expect(mayDecide(stage({ state }))).toBe(false);
  });

  it("never deletes a stage that was once submitted", () => {
    expect(mayDelete(stage())).toBe(true);
    expect(mayDelete(stage({ everSubmitted: true }))).toBe(false);
    expect(mayDelete(stage({ state: "revision_requested", everSubmitted: true }))).toBe(false);
    expect(mayDelete(stage({ state: "approved" }))).toBe(false);
  });

  it("counts approved stages and trims optional text", () => {
    expect(approvedCount([stage({ state: "approved" }), stage(), stage({ state: "approved" })])).toBe(2);
    expect(optionalText("   ")).toBeUndefined();
    expect(optionalText(" ok ")).toBe("ok");
  });

  it("keeps the required Croatian explanation", () => {
    expect(stagesHr.removeBlocked).toBe("Etapu koja je već poslana nije moguće obrisati, samo preimenovati.");
  });
});
