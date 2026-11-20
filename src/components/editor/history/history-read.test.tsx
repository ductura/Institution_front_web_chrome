import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WorkHistory } from "./WorkHistory";
import { historyReadFrom, pointCountKey } from "./history-read";
import { workHistoryMessages as t } from "./messages.hr";

// WEB-9E (E§3.3 history). Invented points only.
const point = (over: object = {}) => ({ id: "t1", revision: 3, savedAt: "2026-11-19T13:05:00.000000Z", reason: "work_submitted", ...over });

describe("work history read", () => {
  it("orders points newest first and keeps nothing but id, kind, time and revision", () => {
    const read = historyReadFrom({ versions: [point({ id: "a", savedAt: "2026-11-18T10:00:00Z", revision: 1 }), point()] });
    expect(read.kind).toBe("points");
    if (read.kind === "points") expect(read.points.map((p) => p.id)).toEqual(["t1", "a"]);
  });
  it("is empty without points and an error for any other shape", () => {
    expect(historyReadFrom({ versions: [] }).kind).toBe("empty");
    for (const bad of [null, {}, { versions: "x" }, { versions: [point({ text: "tekst" })] }, { versions: [point({ reason: "x" })] },
      { versions: [point({ revision: 0 })] }, { versions: [point({ savedAt: "jučer" })] }, { versions: [], extra: 1 }]) {
      expect(historyReadFrom(bad).kind).toBe("error");
    }
  });
  it("uses the Croatian plural", () => {
    expect([1, 2, 5, 11, 12, 21, 24].map(pointCountKey)).toEqual(["one", "few", "many", "many", "many", "one", "few"]);
  });
  it("renders every state without text or size of change", () => {
    const shown = (read: Parameters<typeof WorkHistory>[0]["read"]) => renderToStaticMarkup(<WorkHistory read={read} retryHref="/x" />);
    expect(shown({ kind: "loading" })).toContain(t.loading);
    expect(shown({ kind: "empty" })).toContain(t.empty);
    expect(shown({ kind: "error" })).toContain(t.error);
    const full = shown(historyReadFrom({ versions: [point()] }));
    expect(full).toContain("1 točka");
    expect(full).toContain(t.reasons.work_submitted);
    expect(full).not.toMatch(/riječi|znakova|\+\d/);
  });
});
