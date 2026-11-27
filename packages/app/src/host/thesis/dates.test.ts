// V16 (Ductus#2059, A3/A4): dates a person reads have the full month and a comma, never "·" or a numeric day.
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { TopicMentorView } from "./topic-mentor/section";
import { TopicStudentView } from "./topic-student/section";
import { FormsView } from "./forms/section";
import type { TopicValue } from "./topic-mentor/read";

const topic = (over: Partial<TopicValue> = {}): TopicValue => ({
  state: "approved",
  current: { version: 2, title: "Izmišljena tema", summary: "", proposedAt: "2026-11-17T09:00:00Z" },
  decision: { version: 2, decision: "approved", comment: null, decidedAt: "2026-11-19T09:00:00Z" },
  history: [{ version: 2, title: "Izmišljena tema", proposedAt: "2026-11-17T09:00:00Z" }],
  ...over,
} as unknown as TopicValue);

describe("topic, mentor", () => {
  const html = renderToStaticMarkup(h(TopicMentorView, { documentId: "d", role: "mentor", value: topic(), reload: vi.fn(), call: vi.fn() as never }));
  it("joins the version and the date with a comma and writes the month in full", () => {
    expect(html).toContain("Verzija 2, predloženo 17. studenoga 2026.");
    expect(html).toContain("Verzija 2, 17. studenoga 2026.: Izmišljena tema");
    expect(html).toContain("Odobreno (Verzija 2) dana 19. studenoga 2026.");
  });
  it("has no middle dot", () => expect(html).not.toContain("·"));
});

describe("topic, student", () => {
  it("writes the proposal date with the full month", () => {
    const html = renderToStaticMarkup(h(TopicStudentView, { documentId: "d", role: "student", value: topic(), reload: vi.fn(), call: vi.fn() as never } as never));
    expect(html).toContain("Verzija 2, 17. studenoga 2026.");
    expect(html).not.toMatch(/17\. 11\./);
  });
});

describe("forms", () => {
  it("shows who changed it and the date with the full month", () => {
    const value = {
      forms: [{ code: "x", title: "Obrazac", state: "accepted", changedAt: "2026-11-12T09:00:00Z", changedByPart: "faculty" }],
      consent: {
        state: "withdrawn", comment: null, changedAt: "2026-11-22T09:00:00Z", requiredForSubmission: true,
        history: [{ given: false, changedAt: "2026-11-22T09:00:00Z", comment: null }],
      },
    };
    const html = renderToStaticMarkup(h(FormsView as never, { documentId: "d", role: "student", value, reload: vi.fn(), call: vi.fn() } as never));
    expect(html).toContain("Promijenio fakultet 12. studenoga 2026.");
    expect(html).toContain("Povučena 22. studenoga 2026.");
  });
});
