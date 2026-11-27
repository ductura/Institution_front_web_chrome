// @vitest-environment jsdom
// NF-3 PR-11, PR-12, PR-18 on step 5: what was submitted, the summary that opens with the focus on it,
// one "Sačuvaj potvrdu" with the PDF only, and the fingerprint read as one string. Invented data only.
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ReceiptRead } from "../../../../../../../src/components/predaja/ReceiptPanel";
import ReceiptScreen from "./ReceiptScreen";
import SubmittedReceipt, { type SubmittedPorts } from "./SubmittedReceipt";
import { receiptText as t } from "./messages.hr";
import type { PdfOutcome } from "./pdf";

const saved = vi.fn();
vi.mock("../../../../../../../src/components/editor/EarlierDraft", () => ({ downloadBlob: (...args: unknown[]) => saved(...args) }));
const signIn = vi.fn();
vi.mock("../../../../../../../src/client/api", async (actual) => ({ ...(await actual<object>()), goToSignIn: (...args: unknown[]) => signIn(...args) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const HEX = "0123456789abcdef".repeat(4);
const ASSIGNMENT = "00000000-0000-4000-8000-0000000000a1";
const RECEIPT = {
  kind: "potvrdeno",
  receipt: { payload: {
    submissionId: "5b1f0c7e-3d2a-4c8e-9a41-0f6e2d7b8c13", assignmentId: ASSIGNMENT, requestedAt: "2026-11-12T20:15:00.123456Z",
    dueAt: "2026-11-12T22:00:00.000000Z", signedAt: "2026-11-12T20:16:00.000000Z", afterDeadline: false,
    evidenceRecord: "continuous", artifactSha256: HEX, revision: 3, assignmentVersion: 1,
  } },
} as unknown as Extract<ReceiptRead, { kind: "potvrdeno" }>;

let root: Root | null = null;
let host: HTMLElement | null = null;
const settle = () => act(async () => { for (let i = 0; i < 6; i += 1) await new Promise((r) => setTimeout(r, 0)); });

async function render(element: ReturnType<typeof createElement>) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(element));
  await settle();
  return host;
}
const screen = (props: Partial<Parameters<typeof ReceiptScreen>[0]> = {}) =>
  createElement(ReceiptScreen, { read: RECEIPT, retryHref: "/r", workHref: "/w", homeHref: "/", ...props });
const link = (name: string) => [...host!.querySelectorAll("a")].find((a) => a.textContent === name)!;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  saved.mockReset();
  signIn.mockReset();
});

describe("S-08 K1, K2: the fingerprint", () => {
  it("is not shown in any form: the note and the button that copies it stay", async () => {
    const el = await render(screen());
    expect(el.textContent).not.toContain(HEX);
    expect(el.textContent).not.toContain(HEX.slice(0, 4));
    expect(el.querySelector("[aria-hidden=true] code, .visually-hidden:not([role=status])")).toBeNull();
    expect(el.textContent).toContain(t.fingerprintNote);
    expect([...el.querySelectorAll("button")].map((b) => b.textContent)).toContain(t.copy);
  });

  it("copies the whole string to the clipboard and says so in the toast", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const el = await render(screen());
    await act(async () => [...el.querySelectorAll("button")].find((b) => b.textContent === t.copy)!.click());
    expect(writeText).toHaveBeenCalledWith(HEX);
    expect(el.textContent).toContain(t.copiedToast);
  });
});

describe("PR-11: what was submitted and the summary", () => {
  it("lists the lines it is given under „Što je predano”", async () => {
    const el = await render(screen({ given: ["Verzija teksta: V3", "Riječi: 3"] }));
    const block = el.querySelector("#sb-given")!;
    expect(block.querySelector("h3")?.textContent).toBe(t.givenTitle);
    expect([...block.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["Verzija teksta: V3", "Riječi: 3"]);
  });

  it("opening the summary brings it in, puts the focus on its title and says so", async () => {
    const summary = createElement("section", { "aria-labelledby": "sb-sum-h" }, createElement("h2", { id: "sb-sum-h" }, "Sažetak procesa"));
    const el = await render(screen({ summary }));
    expect(el.querySelector("#sb-sum-h")).toBeNull();
    const open = link(t.openSummary);
    await act(async () => open.click());
    const heading = el.querySelector<HTMLElement>("#sb-sum-h")!;
    expect(document.activeElement).toBe(heading);
    expect(heading.getAttribute("tabindex")).toBe("-1");
    expect(link(t.closeSummary).getAttribute("aria-expanded")).toBe("true");
    expect([...el.querySelectorAll("[role=status]")].map((n) => n.textContent)).toContain(t.summaryOpened);
  });
});

describe("PR-12: „Sačuvaj potvrdu”", () => {
  it("one section with the PDF only: no package for the registrar, no portable record", async () => {
    const el = await render(screen());
    const save = el.querySelector("#sb-save")!;
    expect(save.querySelector("h3")?.textContent).toBe(t.saveTitle);
    expect(save.textContent).toContain(t.saveLead);
    expect([...save.querySelectorAll("a")].map((a) => a.textContent)).toEqual([t.pdf]);
    expect(el.textContent).not.toMatch(/referad|Prenosivi zapis|ZIP/u);
  });

  it("saves the server's PDF under its name", async () => {
    const blob = new Blob(["%PDF"], { type: "application/pdf" });
    const loadPdf = vi.fn(async (): Promise<PdfOutcome> => ({ kind: "ok", blob, filename: "potvrda-predaje.pdf" }));
    await render(screen({ loadPdf }));
    await act(async () => link(t.pdf).click());
    await settle();
    expect(loadPdf).toHaveBeenCalledWith(ASSIGNMENT);
    expect(saved).toHaveBeenCalledWith(blob, "potvrda-predaje.pdf");
  });

  it("a failed download is one alert; a new try clears it", async () => {
    let answer: PdfOutcome = { kind: "failed" };
    const el = await render(screen({ loadPdf: async () => answer }));
    await act(async () => link(t.pdf).click());
    await settle();
    // The toast region keeps its own empty alert region on the page; only the download's alert speaks.
    const alerts = () => [...el.querySelectorAll("[role=alert]")].map((n) => n.textContent).filter((text) => text !== "");
    expect(alerts()).toEqual([t.downloadFailed]);
    answer = { kind: "ok", blob: new Blob(["%PDF"]), filename: "potvrda-predaje.pdf" };
    await act(async () => link(t.pdf).click());
    await settle();
    expect(alerts()).toEqual([]);
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it("a signed-out answer goes to the sign-in and back", async () => {
    await render(screen({ loadPdf: async () => ({ kind: "signedOut" }) }));
    await act(async () => link(t.pdf).click());
    await settle();
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(saved).not.toHaveBeenCalled();
  });
});

describe("PR-11: SubmittedReceipt reads what the receipt stands for", () => {
  const ports = (revision: number): SubmittedPorts => ({
    readWork: async () => ({ kind: "ready", documentId: "izmisljeni-dokument-1", revision, nodes: [{ children: [{ text: "Izmišljeni tekst od pet riječi." }] }] }) as never,
    readSummary: async () => ({ kind: "unavailable" }),
    listNotes: async () => ({ ok: true, status: 200, body: { notes: [{ id: "n1", text: "Izmišljena napomena.", createdAt: "2026-11-04T10:00:00.000Z" }] } }),
    gate: async () => ({ kind: "confirmed", detail: "bound", confirmedAt: "2026-11-04T10:00:00.000000Z" }),
  });
  const lines = () => [...host!.querySelectorAll("#sb-given li")].map((li) => li.textContent);

  it("the version, the words of that version, the declaration and the notes", async () => {
    await render(createElement(SubmittedReceipt, { read: RECEIPT, retryHref: "/r", workHref: "/w", homeHref: "/", ports: ports(3), onSignIn: () => undefined }));
    expect(lines()).toEqual(["Verzija teksta: V3", "Riječi: 5", "Izjava: potvrđena 4. 11. 2026. u 11:00", "Napomene uz rad: 1"]);
  });

  it("the words of another revision are not counted as submitted", async () => {
    await render(createElement(SubmittedReceipt, { read: RECEIPT, retryHref: "/r", workHref: "/w", homeHref: "/", ports: ports(4), onSignIn: () => undefined }));
    expect(lines()[1]).toBe(t.givenWordsUnknown);
  });
});
