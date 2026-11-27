// @vitest-environment jsdom
// N-15 Etape: the card as the design asks (no "·", dates "u", no unsupported actions, delete asks first).
// Stages are invented.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StagesCard } from "./StagesCard";
import * as api from "./stages-api";
import { stagesHr } from "./stages-messages.hr";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("./stages-api", async (original) => ({ ...(await original<typeof import("./stages-api")>()), readStages: vi.fn(), deleteStage: vi.fn() }));

const stage = (over: Record<string, unknown> = {}) => ({
  id: "11111111-1111-4111-8111-111111111111", title: "Izmišljena etapa", description: "", dueAt: "2026-10-15T21:59:00Z",
  state: "not_submitted", everSubmitted: false, submittedRevisionId: null, submittedAt: null, revisionComment: null,
  revisionDueAt: null, revisionRequestedAt: null, approvedAt: null, approvalMessage: null, ...over,
});
const submitted = stage({ id: "22222222-2222-4222-8222-222222222222", title: "Poslana etapa", state: "submitted", everSubmitted: true, submittedAt: "2026-10-14T10:00:00Z" });
const approved = stage({ id: "33333333-3333-4333-8333-333333333333", title: "Odobrena etapa", state: "approved", everSubmitted: true, approvedAt: "2026-10-16T12:05:00Z" });

describe("StagesCard", () => {
  let root: Root | undefined;
  let host: HTMLElement;
  beforeEach(() => {
    // jsdom has no modal dialog: the same open flag the browser sets.
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute("open"); };
    vi.mocked(api.readStages).mockReset(); vi.mocked(api.deleteStage).mockReset();
  });
  afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.innerHTML = ""; });

  const mount = async (onSessionEnd = vi.fn()) => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root?.render(h(StagesCard, { mentor: true, documentId: "izmisljeni-rad-0001", current: () => true, onSessionEnd })); });
    return onSessionEnd;
  };
  const answer = (milestones: unknown[]) => vi.mocked(api.readStages).mockResolvedValue({ ok: true, status: 200, body: { milestones } } as never);

  it("says progress without a middle dot, dates with \"u\" and the approval date by its own label", async () => {
    answer([stage(), submitted, approved]);
    await mount();
    expect(host.querySelector("summary")?.textContent).toBe("Etape, 1 od 3 odobreno");
    expect(host.textContent).not.toContain("·");
    expect(host.textContent).toContain("Rok: 15. listopada 2026. u 23:59");
    expect(host.textContent).toContain("Datum odobrenja: 16. listopada 2026. u 14:05");
  });

  it("approves with a secondary button; the table has \"Br.\", no sends column and no unsupported actions", async () => {
    answer([stage(), submitted]);
    await mount();
    const approve = [...host.querySelectorAll("button")].find((b) => b.textContent === stagesHr.approve);
    expect(approve?.getAttribute("data-tone")).toBe("secondary");
    await act(async () => { [...host.querySelectorAll("button")].find((b) => b.textContent === stagesHr.edit)?.click(); });
    const table = document.body.querySelector("table");
    expect(table?.textContent).toContain("Br.");
    expect(document.body.textContent).not.toContain("Što se šalje");
    expect(document.body.textContent).not.toContain("Dodaj etapu");
    expect(document.body.textContent).not.toContain("Predložak fakulteta");
    expect(document.body.textContent).not.toContain("poslužitelj");
  });

  it("asks before it deletes a stage, and deletes nothing on \"Odustani\"", async () => {
    answer([stage()]);
    vi.mocked(api.deleteStage).mockResolvedValue({ ok: true, status: 204, body: undefined } as never);
    await mount();
    await act(async () => { [...host.querySelectorAll("button")].find((b) => b.textContent === stagesHr.edit)?.click(); });
    // The confirmation's "Obriši" comes last in the document, after the table's own.
    const click = async (name: string) => act(async () => { [...document.body.querySelectorAll("button")].filter((b) => b.textContent === name).at(-1)?.click(); });
    await click(stagesHr.remove);
    expect(api.deleteStage).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Obrisati etapu „Izmišljena etapa”?");
    await click(stagesHr.cancel);
    expect(api.deleteStage).not.toHaveBeenCalled();
    await click(stagesHr.remove);
    await click(stagesHr.deleteConfirm);
    expect(api.deleteStage).toHaveBeenCalledOnce();
  });

  it("frames an unavailable read in an alert with a link to try again, and a missing work without one", async () => {
    vi.mocked(api.readStages).mockResolvedValue({ ok: false, status: 500, code: "x" } as never);
    await mount();
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(stagesHr.unavailable);
    expect([...host.querySelectorAll("button")].some((b) => b.textContent === stagesHr.retry)).toBe(true);
    act(() => root?.unmount());
    vi.mocked(api.readStages).mockResolvedValue({ ok: false, status: 404, code: "not_found" } as never);
    await mount();
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(stagesHr.notFound);
    expect(host.querySelector("button")).toBeNull();
  });

  it("draws no section after the session ended and tells the shell", async () => {
    vi.mocked(api.readStages).mockResolvedValue({ ok: false, status: 401, code: "x" } as never);
    const end = await mount();
    expect(end).toHaveBeenCalledOnce();
    expect(host.innerHTML).toBe("");
  });
});
