import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ConsultationSlot } from "@/client/consultation-slots";

import { SlotsView, type SlotsLoad } from "./ConsultationSlots";
import { consultationSlotsHr as t } from "./messages.hr";
import { IDLE_FORM, timeText, type Role } from "./slots-logic";

const noop = () => undefined;
const slot = (status: ConsultationSlot["state"], startsAt = "2026-11-21T12:00:00.000Z", n = 1): ConsultationSlot =>
  ({ id: `2d8b3e4a-6c7f-4a01-9c3d-4e5f6a7b8c9${n}`, startsAt, proposedAt: "2026-11-20T11:11:00.000Z", state: status });
const view = (role: Role, load: SlotsLoad, extra: Partial<Parameters<typeof SlotsView>[0]> = {}) =>
  renderToStaticMarkup(createElement(SlotsView, {
    load, role, request: IDLE_FORM, forms: {}, onRequestOpen: noop, onRequestDraft: noop, onRequestSend: noop,
    onRequestCancel: noop, onAct: noop, onProposeDraft: noop, onProposeSend: noop, onProposeCancel: noop, onRetry: noop,
    ...extra,
  }));

describe("SlotsView", () => {
  it("the student sees the request button and the empty text; the teacher has no request button", () => {
    const empty: SlotsLoad = { kind: "ready", slots: [] };
    expect(view("student", empty)).toContain(t.requestTitle);
    expect(view("student", empty)).toContain(t.empty);
    expect(view("teacher", empty)).not.toContain(t.requestTitle);
  });
  it("the teacher sees the student's request with confirm and propose", () => {
    const html = view("teacher", { kind: "ready", slots: [slot("requested")] });
    expect(html).toContain(t.status.requested.teacher);
    expect(html).toContain(t.confirm);
    expect(html).toContain(t.propose);
  });
  it("the student sees the counter-proposal and can accept that time", () => {
    const alt = "2026-11-24T13:30:00.000Z";
    const html = view("student", { kind: "ready", slots: [slot("countered", alt)] });
    expect(html).toContain(t.status.countered.student);
    expect(html).toContain(t.accept.replace("{time}", timeText(alt)));
    expect(html).not.toContain(t.confirm);
  });
  it("a confirmed slot is the same time for both sides, with no actions", () => {
    const list: SlotsLoad = { kind: "ready", slots: [slot("confirmed")] };
    const [s, te] = [view("student", list), view("teacher", list)];
    for (const html of [s, te]) {
      expect(html).toContain(t.confirmedLine.replace("{time}", timeText("2026-11-21T12:00:00.000Z")));
      expect(html).not.toContain(t.confirm);
      expect(html).not.toContain("aria-pressed");
    }
  });
  it("keeps the typed time and shows the reason after a network error", () => {
    const failed = { open: true, draft: "2026-11-21T13:00", busy: false, error: t.errors.unknown };
    const html = view("student", { kind: "ready", slots: [] }, { request: failed });
    expect(html).toContain('value="2026-11-21T13:00"');
    expect(html).toContain(t.errors.unknown);
    const s = slot("requested");
    const teacher = view("teacher", { kind: "ready", slots: [s] }, { forms: { [s.id]: failed } });
    expect(teacher).toContain('value="2026-11-21T13:00"');
    expect(teacher).toContain(t.errors.unknown);
  });
  it("loading, unavailable (with retry), not found and signed out", () => {
    expect(view("student", { kind: "loading" })).toContain(t.loading);
    expect(view("student", { kind: "unavailable" })).toContain(t.retry);
    expect(view("student", { kind: "notFound" })).not.toContain(t.retry);
    expect(view("student", { kind: "signedOut" })).toContain(t.errors.signedOut);
  });
});
