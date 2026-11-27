import { describe, expect, it } from "vitest";

import { workspaceSubtitle } from "./workspace-subtitle";

// Design alignment 27. 11. 2026. (S-07, text 2). Invented data only.
const base = { kind: "ready" as const, course: "Izmišljeni seminar iz ekologije grada", title: "Izmišljeni rad", dueAt: "2026-11-30T22:59:00.000Z", workState: "in_progress" as const };

describe("workspaceSubtitle", () => {
  it("joins course, kind and deadline with commas", () => {
    expect(workspaceSubtitle({ ...base, workType: "essay" })).toBe("Izmišljeni seminar iz ekologije grada, Esej, rok 30. studenoga 2026. u 23:59");
  });

  it("shows the extended deadline when there is one", () => {
    expect(workspaceSubtitle({ ...base, extendedDueAt: "2026-12-04T22:59:00.000Z" })).toBe("Izmišljeni seminar iz ekologije grada, rok 4. prosinca 2026. u 23:59");
  });

  it("leaves out an unknown kind and an unreadable deadline, never a raw value", () => {
    const line = workspaceSubtitle({ ...base, workType: "unknown_kind", dueAt: "nije datum" });
    expect(line).toBe("Izmišljeni seminar iz ekologije grada");
    expect(line).not.toContain("·");
  });
});
