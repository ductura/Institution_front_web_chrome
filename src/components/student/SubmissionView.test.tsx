import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { SubmitOutcome } from "@/client/submission";
import { messagesHr } from "@/lib/i18n/messages.hr";

import { nextOf, OUTCOME_ID, SubmissionView, type Next, type SubmissionViewProps, type WorkRead } from "./SubmissionView";

// WEB-26 (S: E-10, PD-3). Invented text of an invented work only.
const t = messagesHr.submit;
const nothing = () => undefined;
const WORK: WorkRead = {
  kind: "ready", documentId: "doc-izmisljeni-1", revision: 7,
  nodes: [
    { type: "heading", level: 1, children: [{ text: "Uvod", marks: [] }] },
    { type: "paragraph", children: [{ text: "Izmišljeni odlomak o lokalnoj samoupravi.", marks: ["italic"] }] },
    { type: "bulletItem", children: [{ text: "prva točka", marks: [] }] },
    { type: "bulletItem", children: [{ text: "druga točka", marks: [] }] },
  ],
};

function render(over: Partial<SubmissionViewProps> = {}): string {
  return renderToStaticMarkup(
    <SubmissionView work={WORK} stage={{ kind: "open" }} confirmed online sending={false} checking={false} next={null}
      onOpen={nothing} onCheck={nothing} onReload={nothing} onDeclaration={nothing} onBack={nothing} {...over} />,
  );
}

const button = (markup: string, label: string) => markup.match(new RegExp(`<button[^>]*>${label}</button>`))?.[0] ?? "";
const text = (markup: string) => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
const line = (next: Next) => (next.go === null ? next.text : next.go);

describe("SubmissionView (WEB-26, S: E-10)", () => {
  it("is step 4 and shows the text of the revision it sends", () => {
    const markup = render();
    expect(text(markup.match(/<li aria-current="step">.*?<\/li>/)?.[0] ?? "").trim()).toBe("4 Predaja");
    expect(markup).toContain(`${t.textTitle} (${t.revision}: 7)`);
    expect(markup).toContain("<h2>");
    expect(markup).toContain("<em>Izmišljeni odlomak o lokalnoj samoupravi.</em>");
    expect(markup).toMatch(/<ul><li>.*prva točka.*<\/li><li>.*druga točka.*<\/li><\/ul>/);
    expect(button(markup, t.submit)).not.toContain("disabled");
  });

  it("never says the work is submitted on any variant", () => {
    for (const markup of [render(), render({ work: { kind: "loading" } }), render({ sending: true }), render({ next: { go: null, text: t.unknown, offer: "check", retry: false } })]) {
      expect(text(markup)).not.toMatch(/\bpredano\b|Rad je predan/i);
    }
  });

  it("variants ucitavanje, greska and prazno send nothing", () => {
    expect(render({ work: { kind: "loading" } })).toContain(t.loading);
    const error = render({ work: { kind: "unavailable" } });
    expect(error).toContain(t.unavailable);
    expect(button(error, t.reload)).not.toBe("");
    const empty = render({ work: { kind: "empty" } });
    expect(empty).toContain(t.empty);
    for (const markup of [error, empty]) expect(button(markup, t.submit)).toContain("disabled");
  });

  it("variant bezmreze keeps the button closed and says why", () => {
    const markup = render({ online: false });
    expect(button(markup, t.submit)).toContain("disabled");
    expect(button(markup, t.submit)).toContain("aria-describedby");
    expect(markup).toContain(t.offline);
  });

  it("variant nakonroka says so before anything is sent and still lets the student submit", () => {
    const markup = render({ stage: { kind: "closed", dueAt: "2026-11-15T22:59:00.000Z" } });
    expect(markup).toContain(`${t.late}: 15. studenoga 2026. ${messagesHr.summary.at} 23:59.`);
    expect(markup).toContain(t.lateNote);
    expect(button(markup, t.submit)).not.toContain("disabled");
  });

  it("an unconfirmed declaration sends the student back to step 2 (C-3)", () => {
    const markup = render({ confirmed: false });
    expect(button(markup, t.submit)).toBe("");
    expect(button(markup, t.toDeclaration)).not.toBe("");
    expect(markup).toContain(t.declarationMissing);
  });

  it("variant nepoznato offers \"Provjeri stanje predaje\" and no second submission", () => {
    const markup = render({ next: nextOf({ kind: "nepoznato" }) as Extract<Next, { go: null }> });
    expect(markup).toContain(`id="${OUTCOME_ID}"`);
    expect(markup).toContain(t.unknown);
    expect(button(markup, t.check)).not.toBe("");
    expect(button(markup, t.submit)).toContain("disabled");
    expect(render({ next: nextOf({ kind: "nepoznato" }) as Extract<Next, { go: null }>, checking: true })).toContain(t.checking);
  });

  // Design alignment 27. 11. 2026. (S-08): load alerts framed; a failure line red, a state line plain.
  it("frames the work and deadline load failures as alerts", () => {
    expect(render({ work: { kind: "unavailable" } })).toMatch(new RegExp(`role="alert"[^>]*>${t.unavailable}</p>`));
    expect(render({ stage: { kind: "unavailable" } })).toMatch(new RegExp(`role="alert"[^>]*>${t.stageUnavailable.replace(/\./g, "\\.")}</p>`));
  });

  it("colours the outcome line only when it reports a failure", () => {
    const failed = (next: Next) => render({ next: next as Extract<Next, { go: null }> }).includes("submission__outcome--error");
    expect(failed(nextOf({ kind: "nepoznato" }))).toBe(true);
    expect(failed(nextOf({ kind: "nedovrseno" }))).toBe(true);
    expect(failed(nextOf({ kind: "odbijeno", reason: "no_evidence" }))).toBe(true);
    expect(failed(nextOf({ kind: "greska", code: "not_open" }))).toBe(true);
    expect(failed(nextOf({ kind: "check", state: { kind: "ceka", revision: 7, requestedAt: "2026-11-15T21:00:00.000000Z" } }))).toBe(false);
    expect(failed(nextOf({ kind: "check", state: { kind: "none" } }))).toBe(false);
  });
});

describe("nextOf: the closed outcome table (S: PO-17, P-10)", () => {
  const receipt = {} as Extract<SubmitOutcome, { kind: "predano" }>["receipt"];

  it("moves to step 5 only on a receipt", () => {
    expect(nextOf({ kind: "predano", receipt })).toEqual({ go: "receipt" });
    expect(nextOf({ kind: "check", state: { kind: "potvrdeno", receipt } })).toEqual({ go: "receipt" });
    expect(nextOf({ kind: "stanje", revision: 7, state: { kind: "potvrdeno", receipt } })).toEqual({ go: "receipt" });
  });

  it("ceka after the check is never success and offers the check again", () => {
    const next = nextOf({ kind: "check", state: { kind: "ceka", revision: 7, requestedAt: "2026-11-15T21:00:00.000000Z" } });
    expect(next).toEqual({ go: null, text: t.waiting, offer: "check", retry: false });
  });

  it("maps refusals, incomplete and unknown to their own lines", () => {
    expect(line(nextOf({ kind: "odbijeno", reason: "segment_unsigned" }))).toBe(t.blocked.segment_unsigned);
    expect(line(nextOf({ kind: "odbijeno", reason: "record_discontinuous" }))).toBe(t.blocked.record_discontinuous);
    expect(line(nextOf({ kind: "odbijeno", reason: "no_evidence" }))).toBe(t.blocked.no_evidence);
    expect(line(nextOf({ kind: "nedovrseno" }))).toBe(t.incomplete);
    expect(nextOf({ kind: "nepoznato" })).toEqual({ go: null, text: t.unknown, offer: "check", retry: false });
    expect(line(nextOf({ kind: "check", state: { kind: "nepoznato" } }))).toBe(t.unknown);
    expect(nextOf({ kind: "check", state: { kind: "none" } })).toEqual({ go: null, text: t.notRecorded, retry: true });
  });

  it("maps the errors the inventory does not name (P-10 proposal)", () => {
    expect(nextOf({ kind: "greska", code: "stale_revision", currentRevision: 8 })).toEqual({ go: null, text: t.errors.stale_revision, offer: "reload", retry: false });
    expect(nextOf({ kind: "greska", code: "not_acknowledged" })).toEqual({ go: "notice" });
    expect(line(nextOf({ kind: "greska", code: "not_open" }))).toBe(t.errors.not_open);
    expect(line(nextOf({ kind: "greska", code: "too_large" }))).toBe(t.errors.too_large);
    expect(line(nextOf({ kind: "greska", code: "upgrade_required" }))).toBe(t.errors.upgrade_required);
    expect(line(nextOf({ kind: "greska", code: "client_rejected" }))).toBe(t.errors.other);
  });

  it("an ended session goes to sign-in", () => {
    expect(nextOf({ kind: "session-expired" })).toEqual({ go: "signIn" });
    expect(nextOf({ kind: "check", state: { kind: "session-expired" } })).toEqual({ go: "signIn" });
  });
});
