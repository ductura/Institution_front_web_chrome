// WEB-32 (N-16, B-6), LOK-WEB-5: the card of mentorship requests over invented
// requests in the server's shape; no real call.
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { MentorshipCall, MentorshipRequest } from "@/client/mentorship-requests";
import { messagesHr } from "@/lib/i18n/messages.hr";

import { findForbiddenTerms } from "../../../scripts/forbidden-terms/terms.ts";
import MentorshipRequests, { decisionNote, MentorshipRequestsView, reasonToSend, submitDecision } from "./MentorshipRequests";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const t = messagesHr.mentorshipRequests;
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const request = (n: number, studentName: string | null): MentorshipRequest => ({
  requestId: `2d8b3e4a-6c7f-4a01-9c3d-4e5f6a7b8c${String(n).padStart(2, "0")}`,
  studentName, workType: "bachelor_thesis", requestedAt: "2026-11-10T08:00:00Z",
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
    for (const outcome of [{ kind: "nepoznato" }, { kind: "greska", code: "invalid" }] as const) {
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

// A synthetic transport: records each call and gives the answer it was set up with.
function transport(answer: Awaited<ReturnType<MentorshipCall>> | Error) {
  const calls: Parameters<MentorshipCall>[] = [];
  const call: MentorshipCall = async (...args) => {
    calls.push(args);
    if (answer instanceof Error) throw answer;
    return answer;
  };
  return { call, calls };
}
function deps(call: MentorshipCall | null) {
  const seen = { refresh: 0, signIn: 0 };
  return { seen, deps: { call, refresh: () => { seen.refresh += 1; }, signIn: () => { seen.signIn += 1; } } };
}
const ONE = request(1, "Iva Izmišljena");

describe("submitDecision over a synthetic transport (B-6)", () => {
  it("\"Odbij\" → \"Odbij zahtjev\" sends the trimmed reason, then drops the request and reads the page again", async () => {
    const { call, calls } = transport({ ok: true, status: 200, body: { decision: "decline" } });
    const { seen, deps: d } = deps(call);
    expect(await submitDecision(d, ONE, "decline", "  Tema je izvan mog područja.  ")).toEqual({ tone: "status", text: t.declined, drop: true });
    expect(calls).toEqual([["teacher.mentorship-request-decision.post",
      { params: undefined, query: undefined, body: { requestId: ONE.requestId, decision: "decline", reason: "Tema je izvan mog područja." } }]]);
    expect(seen).toEqual({ refresh: 1, signIn: 0 });
  });

  it("a blank reason is not sent, and approve never sends one", async () => {
    const declined = transport({ ok: true, status: 200, body: { decision: "decline" } });
    await submitDecision(deps(declined.call).deps, ONE, "decline", "   ");
    expect(declined.calls[0]?.[1]).toEqual({ params: undefined, query: undefined, body: { requestId: ONE.requestId, decision: "decline" } });
    const approved = transport({ ok: true, status: 200, body: { decision: "approve", mentorshipId: ONE.requestId } });
    const { seen, deps: d } = deps(approved.call);
    expect(await submitDecision(d, ONE, "approve", "ostatak iz polja")).toEqual({ tone: "status", text: t.approved, drop: true });
    expect(approved.calls[0]?.[1]).toEqual({ params: undefined, query: undefined, body: { requestId: ONE.requestId, decision: "approve" } });
    expect(seen.refresh).toBe(1);
  });

  it.each([
    ["503", { ok: false, status: 503, code: "unavailable" } as const],
    ["an answer for another decision", { ok: true, status: 200, body: { decision: "approve", mentorshipId: ONE.requestId } } as const],
    ["a broken connection", new TypeError("Failed to fetch")],
  ])("%s keeps the request, says nothing of success and reads nothing again", async (_name, answer) => {
    const { call } = transport(answer);
    const { seen, deps: d } = deps(call);
    expect(await submitDecision(d, ONE, "decline", "Razlog")).toEqual({ tone: "alert", text: t.unknown, drop: false });
    expect(seen).toEqual({ refresh: 0, signIn: 0 });
  });

  it("409 drops the request as already decided and reads the page again", async () => {
    const { seen, deps: d } = deps(transport({ ok: false, status: 409, code: "conflict" }).call);
    expect(await submitDecision(d, ONE, "approve")).toEqual({ tone: "alert", text: t.alreadyDecided, drop: true });
    expect(seen).toEqual({ refresh: 1, signIn: 0 });
  });

  it("401 goes to the sign-in with no note", async () => {
    const { seen, deps: d } = deps(transport({ ok: false, status: 401, code: "session_expired" }).call);
    expect(await submitDecision(d, ONE, "approve")).toBeNull();
    expect(seen).toEqual({ refresh: 0, signIn: 1 });
  });

  it("without a transport (TODO(ugovor)) nothing is sent and the outcome is unknown", async () => {
    const { seen, deps: d } = deps(null);
    expect(await submitDecision(d, ONE, "approve")).toEqual({ tone: "alert", text: t.unknown, drop: false });
    expect(seen).toEqual({ refresh: 0, signIn: 0 });
  });
});

describe("MentorshipRequests", () => {
  it("draws each request with its student, type and both decisions; no title (the server sends none)", () => {
    const html = renderToStaticMarkup(h(MentorshipRequestsView, {
      read: { kind: "ready", requests: [request(1, "Iva Izmišljena"), request(2, null)] }, here: HERE, call: null,
    }));
    const shown = text(html);
    expect(shown).toContain(t.title);
    expect(shown).toContain("Iva Izmišljena Završni rad · Zahtjev poslan");
    expect(shown).toContain(`${t.unnamed} Završni rad · Zahtjev poslan`);
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
