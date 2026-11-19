// WEB-32 (N-16, B-6): the card of mentorship requests over invented requests
// only, until contract 3.2.0 (TODO(ugovor)); no real call.
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { MentorshipRequest } from "@/client/mentorship-requests";
import { messagesHr } from "@/lib/i18n/messages.hr";

import { findForbiddenTerms } from "../../../scripts/forbidden-terms/terms.ts";
import MentorshipRequests, { decisionNote, MentorshipRequestsView, reasonToSend } from "./MentorshipRequests";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const t = messagesHr.mentorshipRequests;
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const request = (n: number, studentName: string | null): MentorshipRequest => ({
  requestId: `2d8b3e4a-6c7f-4a01-9c3d-4e5f6a7b8c${String(n).padStart(2, "0")}`,
  studentName, title: `Izmišljeni naslov ${n}`, workType: "bachelor_thesis", requestedAt: "2026-11-10T08:00:00Z",
});
const HERE = "/nastavnik/mentorstva";

describe("decisionNote (B-6)", () => {
  it("says approved or declined only after the server recorded it, and drops the request", () => {
    expect(decisionNote({ kind: "odluceno", requestId: "x", decision: "approve" }, "approve")).toEqual({ tone: "status", text: t.approved, drop: true });
    expect(decisionNote({ kind: "odluceno", requestId: "x", decision: "decline" }, "decline")).toEqual({ tone: "status", text: t.declined, drop: true });
  });

  it("drops an already decided request with a notice, not a success", () => {
    expect(decisionNote({ kind: "vec-odluceno" }, "approve")).toEqual({ tone: "alert", text: t.alreadyDecided, drop: true });
  });

  it("keeps the request on an unknown outcome or an error, and never says it was decided", () => {
    for (const outcome of [{ kind: "nepoznato" }, { kind: "greska", code: "not_found" }, { kind: "greska", code: "invalid" }] as const) {
      const note = decisionNote(outcome, "approve");
      expect(note?.drop).toBe(false);
      expect(note?.tone).toBe("alert");
      expect([t.approved, t.declined]).not.toContain(note?.text);
    }
  });

  it("leaves an ended session to the sign-in", () => {
    expect(decisionNote({ kind: "session-expired" }, "decline")).toBeNull();
  });
});

describe("reasonToSend", () => {
  it("sends no reason for a blank field and a trimmed one otherwise", () => {
    expect(reasonToSend("")).toBeUndefined();
    expect(reasonToSend("  \n ")).toBeUndefined();
    expect(reasonToSend("  Tema je izvan mog područja. ")).toBe("Tema je izvan mog područja.");
  });
});

describe("MentorshipRequests", () => {
  it("draws each request with its student, title, type and both decisions", () => {
    const html = renderToStaticMarkup(h(MentorshipRequestsView, {
      read: { kind: "ready", requests: [request(1, "Iva Izmišljena"), request(2, null)] }, here: HERE, call: null,
    }));
    const shown = text(html);
    expect(shown).toContain(t.title);
    expect(shown).toContain("Iva Izmišljena Izmišljeni naslov 1 Završni rad · Zahtjev poslan");
    expect(shown).toContain(`${t.unnamed} Izmišljeni naslov 2`);
    expect(html).toContain(`aria-label="${t.approve}: Iva Izmišljena"`);
    expect(html).toContain(`aria-label="${t.decline}: ${t.unnamed}"`);
    expect(shown).not.toContain(t.approved);
  });

  it("says when there is no request", () => {
    const shown = text(renderToStaticMarkup(h(MentorshipRequestsView, { read: { kind: "ready", requests: [] }, here: HERE, call: null })));
    expect(shown).toContain(t.empty);
  });

  it("says an unread list is unavailable, never empty, with a way to try again", () => {
    const html = renderToStaticMarkup(h(MentorshipRequests, { read: { kind: "unavailable" }, here: HERE }));
    expect(text(html)).toContain(t.unavailable);
    expect(text(html)).not.toContain(t.empty);
    expect(html).toContain(`href="${HERE}"`);
  });

  it("uses no forbidden term", () => {
    expect(findForbiddenTerms(Object.values(t).join("\n"))).toEqual([]);
  });
});
