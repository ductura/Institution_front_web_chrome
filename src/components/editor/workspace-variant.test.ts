import { describe, expect, it } from "vitest";

import { workspaceFrame } from "./workspace-variant";

// WEB-23 (S: E-7): the frame of the workspace for each read. TODO(ugovor): the
// submission and requirements answers are invented fixtures until 3.1.0.
const ready = (workState: "not_started" | "in_progress" | "submitted") =>
  ({ kind: "ready", course: "Izmišljeni seminar", title: "Izmišljeni rad", dueAt: "2026-12-01T12:00:00.000000Z", workState }) as const;
const range = { kind: "ready", wordRange: { min: 1200, max: 1600 } } as const;
const receipt = { kind: "potvrdeno", receipt: {} } as never;

describe("workspaceFrame", () => {
  it("maps the work state to puno, prazno and predano", () => {
    expect(workspaceFrame(ready("in_progress")).variant).toBe("puno");
    expect(workspaceFrame(ready("not_started")).variant).toBe("prazno");
    expect(workspaceFrame(ready("submitted")).variant).toBe("predano");
  });

  it("is greska when the server could not answer, with no range", () => {
    expect(workspaceFrame({ kind: "unavailable" }, undefined, range)).toEqual({ variant: "greska", range: null });
  });

  it("is predano when the submission read holds a receipt", () => {
    expect(workspaceFrame(ready("in_progress"), receipt).variant).toBe("predano");
  });

  it("never looks submitted from a waiting or failed submission read (B-6)", () => {
    for (const submission of [
      { kind: "ceka", revision: 3, requestedAt: "2026-11-19T10:00:00.000000Z" },
      { kind: "nepoznato" },
      { kind: "greska", code: "not_found" },
      { kind: "session-expired" },
      { kind: "none" },
    ] as const) {
      expect(workspaceFrame(ready("in_progress"), submission).variant).toBe("puno");
    }
  });

  it("takes the range from the requirements read only when it is ready", () => {
    expect(workspaceFrame(ready("in_progress"), undefined, range).range).toEqual({ min: 1200, max: 1600 });
    expect(workspaceFrame(ready("in_progress"), undefined, { kind: "nepoznato" }).range).toBeNull();
    expect(workspaceFrame(ready("in_progress")).range).toBeNull();
  });
});
