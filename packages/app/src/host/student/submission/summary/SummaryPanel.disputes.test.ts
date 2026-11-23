// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApi } from "../../../../../../../src/client/api.ts";
import { createEventDisputes, MAX_DISPUTE_LENGTH } from "../../../../../../../src/client/event-disputes.ts";
import type { ProcessSummaryV1 } from "../../../../../../../src/client/process-summary.ts";

import SummaryPanel, { type SummaryPanelProps } from "./SummaryPanel";

HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Invented record and marks: two sessions, two pastes, one gap.
const BASE_URL = "https://ductura.example.invalid";
const DOC = "izmisljeni-rad-0001";
const SUMMARY: ProcessSummaryV1 = {
  summaryFormat: "ductus-process-summary-v1",
  sessions: { evidenceKind: "observed", breakAboveMinutes: 30, count: 2, items: [
    { from: "2026-10-20T16:05:00.000Z", to: "2026-10-20T17:40:00.000Z" },
    { from: "2026-11-05T18:00:00.000Z", to: "2026-11-05T20:05:00.000Z" },
  ] },
  pastes: { evidenceKind: "observed", listedAboveCharacters: 200, smallerCount: 0, listed: [
    { at: { from: "2026-10-20T16:30:00.000Z", to: "2026-10-20T16:35:00.000Z" }, characters: 640, origin: "not_observed" },
    { at: { from: "2026-11-05T18:30:00.000Z", to: "2026-11-05T18:35:00.000Z" }, characters: 320, origin: "not_observed" },
  ] },
  gaps: { evidenceKind: "observed", items: [{ previousEndedAt: "2026-10-20T17:40:00.000Z", nextStartedAt: "2026-11-05T18:00:00.000Z" }] },
  recordState: "has_gaps",
};
const MARK = { disputeId: "00000000-0000-4000-8000-0000000000d1", kind: "dispute", eventId: "pastes/1", text: "Izmišljeno: lijepljenje iz mojih bilješki.", createdAt: "2026-11-21T09:15:00.123Z" };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const ERROR = (code: string, status: number) => ({ error: code, code, messageKey: "errors.x", status, requestId: MARK.disputeId });

type Answer = (method: string) => Response;

function server(answer: Answer) {
  const fetchImpl = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => answer(init?.method ?? "GET"));
  return { port: createEventDisputes(createApi({ baseUrl: BASE_URL, fetchImpl })), fetchImpl };
}

const base: SummaryPanelProps = {
  summary: { kind: "ready", summary: SUMMARY }, notes: { kind: "ready", notes: [] }, submitted: false, confirmed: true,
  online: true, workHref: "/rad/a-1", onRetry: () => undefined, onAddNote: async () => ({ kind: "unavailable" }) as never, onNoteAdded: () => undefined,
};

describe("process summary with event disputes (WEB-1305 in E-8)", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.innerHTML = ""; });
  const mount = async (props: SummaryPanelProps) => {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(SummaryPanel, props)); });
    return host;
  };
  const MARKS = '[aria-label="Dopune i osporavanja događaja"]';
  const marks = (host: HTMLElement) => [...host.querySelectorAll(`${MARKS} li`)].map((li) => li.textContent?.replace(/^(Dopuna|Osporavanje)/, "") ?? "");
  const eventText = (host: HTMLElement) => [...host.querySelectorAll(".facts > li, .list > li")].map((li) => li.firstChild?.textContent ?? "");
  const gets = (fetchImpl: ReturnType<typeof server>["fetchImpl"]) => fetchImpl.mock.calls.filter(([, init]) => (init?.method ?? "GET") === "GET");
  const posts = (fetchImpl: ReturnType<typeof server>["fetchImpl"]) => fetchImpl.mock.calls.filter(([, init]) => init?.method === "POST");

  it("reads the marks of every event with one GET for the work and shows each under its own event", async () => {
    const { port, fetchImpl } = server(() => json(200, { disputes: [MARK] }));
    const host = await mount({ ...base, disputes: { port, documentId: DOC } });
    expect(gets(fetchImpl)).toHaveLength(1);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(`${BASE_URL}/api/v1/works/${DOC}/event-disputes`);
    const pastes = [...host.querySelectorAll(".list > li")];
    expect(pastes).toHaveLength(2);
    expect(pastes[0]?.textContent).not.toContain(MARK.text);
    expect(pastes[1]?.textContent).toContain(MARK.text);
    // Five events (two sessions, two pastes, one gap), each with its two actions.
    expect([...host.querySelectorAll("button")].filter((b) => b.textContent === "Ospori opis")).toHaveLength(5);
  });

  it("a failed read is said once, and the events read as they do without marks", async () => {
    const plain = eventText(await mount(base));
    act(() => root?.unmount());
    document.body.innerHTML = "";
    const { port, fetchImpl } = server(() => json(503, ERROR("unavailable", 503)));
    const host = await mount({ ...base, disputes: { port, documentId: DOC } });
    expect(gets(fetchImpl)).toHaveLength(1);
    expect(host.textContent?.split("Dopune i osporavanja trenutačno nije moguće učitati.").length).toBe(2);
    expect(eventText(host)).toEqual(plain);
  });

  const write = async (host: HTMLElement, text: string) => {
    const open = [...host.querySelectorAll("button")].find((b) => b.textContent === "Ospori opis") as HTMLButtonElement;
    await act(async () => { open.click(); });
    const area = document.querySelector("textarea") as HTMLTextAreaElement;
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    act(() => { set?.call(area, text); area.dispatchEvent(new Event("input", { bubbles: true })); });
    const send = [...document.querySelectorAll("button")].find((b) => b.textContent === "Pošalji") as HTMLButtonElement;
    await act(async () => { send.click(); });
  };

  it("a dispute is shown only after the server's 201 confirms it", async () => {
    const { port, fetchImpl } = server((method) => method === "POST"
      ? json(201, { disputeId: "00000000-0000-4000-8000-0000000000d2", createdAt: "2026-11-22T10:00:00.000Z" })
      : json(200, { disputes: [] }));
    const host = await mount({ ...base, disputes: { port, documentId: DOC } });
    await write(host, "Izmišljeno: sesija je bila kraća.");
    expect(posts(fetchImpl)).toHaveLength(1);
    expect(JSON.parse(String(posts(fetchImpl)[0]?.[1]?.body))).toEqual({ eventId: "sessions/0", kind: "dispute", text: "Izmišljeno: sesija je bila kraća." });
    expect(marks(host)).toEqual(["Izmišljeno: sesija je bila kraća."]);
    expect(host.querySelector(".facts > li")?.querySelector(MARKS)?.textContent).toContain("Izmišljeno: sesija je bila kraća.");
    expect(gets(fetchImpl)).toHaveLength(1);
  });

  it("a refused dispute is not shown", async () => {
    const { port, fetchImpl } = server((method) => method === "POST" ? json(503, ERROR("unavailable", 503)) : json(200, { disputes: [] }));
    const host = await mount({ ...base, disputes: { port, documentId: DOC } });
    await write(host, "Izmišljeno: ovo poslužitelj nije zabilježio.");
    expect(posts(fetchImpl)).toHaveLength(1);
    expect(marks(host)).toEqual([]);
  });

  it(`a text over ${MAX_DISPUTE_LENGTH} characters is never sent`, async () => {
    const { port, fetchImpl } = server(() => json(200, { disputes: [] }));
    const host = await mount({ ...base, disputes: { port, documentId: DOC } });
    await write(host, "x".repeat(MAX_DISPUTE_LENGTH + 1));
    expect(posts(fetchImpl)).toHaveLength(0);
    expect(marks(host)).toEqual([]);
  });

  it("without a document the summary stands alone and reads nothing", async () => {
    const host = await mount(base);
    expect([...host.querySelectorAll("button")].filter((b) => b.textContent === "Ospori opis")).toHaveLength(0);
  });
});
