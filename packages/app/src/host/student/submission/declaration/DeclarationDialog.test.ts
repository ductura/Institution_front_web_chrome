// @vitest-environment jsdom
// NF-3 PR-5 (PD-10, E-9c): the declaration as a dialog from steps 3 and 4, on the real step ports over a
// recorded server. A stale confirmation is said once and confirmed again; the box is checked only on the
// server's answer; closing hands back to the step. Invented data only.
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApi } from "../../../../../../../src/client/api.ts";
import { ASSIGNMENT, CONFIRMED, DRAFT, gateServer } from "../summary/declaration-gate.fixture";
import { readDeclarationGate } from "../../../../../../../src/client/declaration.ts";
import DeclarationDialog from "./DeclarationDialog";
import { dialogOpener, isStale } from "./dialog-model";
import { declarationStepText as t } from "./messages.hr";
import { createStepPorts } from "./step-ports";

HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
/** Confirmed for revision 2 while the text is now at revision 3: the confirmation went stale. */
const STALE = { ...DRAFT, currentRevision: 3 };

function server(start: Record<string, unknown>) {
  let state = { ...start };
  const puts: unknown[] = [];
  const fetchImpl: typeof fetch = async (_input, init) => {
    if ((init?.method ?? "GET") === "GET") return json(200, state);
    const body = JSON.parse(String(init?.body)) as { confirm: boolean };
    puts.push(body);
    state = { ...state, version: (state.version as number) + 1, state: body.confirm ? "confirmed" : "draft" };
    return json(200, state);
  };
  return { puts, ports: createStepPorts(createApi({ baseUrl: "https://ductura.example.invalid", fetchImpl })) };
}

let root: Root | null = null;
const settle = () => act(async () => { for (let i = 0; i < 6; i += 1) await new Promise((r) => setTimeout(r, 0)); });
afterEach(() => { act(() => root?.unmount()); root = null; document.body.innerHTML = ""; });

async function show(ports: ReturnType<typeof createStepPorts>, stale: boolean) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const onClose = vi.fn();
  await act(async () => {
    root!.render(createElement(DeclarationDialog, { assignmentId: ASSIGNMENT, open: true, stale, ports, onClose, onSignIn: () => undefined }));
  });
  await settle();
  const box = () => document.querySelector<HTMLInputElement>("#sb-dialog-confirm")!;
  return { onClose, box };
}

describe("the openers on steps 3 and 4 (PR-5)", () => {
  it("name a stale confirmation apart from one never given, and offer nothing once confirmed", async () => {
    const read = (state: unknown) => readDeclarationGate(createApi({ baseUrl: "https://ductura.example.invalid", fetchImpl: async () => json(200, state) }), ASSIGNMENT);
    const stale = await read({ ...CONFIRMED, currentRevision: 3 });
    expect(isStale(stale)).toBe(true);
    expect(dialogOpener(stale)).toBe(t.reconfirm);
    const draft = await gateServer(() => DRAFT).read(ASSIGNMENT);
    expect(isStale(draft)).toBe(false);
    expect(dialogOpener(draft)).toBe(t.openDialog);
    expect(dialogOpener(await gateServer(() => CONFIRMED).read(ASSIGNMENT))).toBeNull();
    expect(dialogOpener({ kind: "loading" })).toBeNull();
  });
});

describe("DeclarationDialog (PD-10)", () => {
  it("is a modal dialog with the declaration's title and says the student stays on the step", async () => {
    await show(server(DRAFT).ports, false);
    const dialog = document.querySelector("dialog");
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(dialog?.querySelector("h2")?.textContent).toBe(t.title);
    expect(dialog?.textContent).toContain(t.dialogMeta);
    expect(dialog?.textContent).not.toContain(t.staleNotice);
  });

  it("a stale confirmation is said once and confirmed again; the box checks only on the server's answer", async () => {
    const s = server(STALE);
    const view = await show(s.ports, true);
    expect([...document.querySelectorAll('dialog [role="status"]')].map((el) => el.textContent)).toContain(t.staleNotice);
    expect(view.box().closest("label")?.textContent).toContain(t.confirmAgain);
    expect(view.box().checked).toBe(false);
    await act(async () => view.box().click());
    await settle();
    expect(s.puts).toEqual([expect.objectContaining({ confirm: true })]);
    expect(view.box().checked).toBe(true);
    // Once the server holds it, the dialog no longer says the confirmation is stale.
    expect(document.querySelector("dialog")?.textContent).not.toContain(t.staleNotice);
  });

  it("an empty declaration cannot be confirmed from the dialog", async () => {
    const s = server({ ...DRAFT, draft: null });
    const view = await show(s.ports, false);
    expect(view.box().disabled).toBe(true);
    expect(document.querySelector("dialog")?.textContent).toContain(t.fillFirst);
    await act(async () => view.box().click());
    expect(s.puts).toEqual([]);
  });

  it("Zatvori and Escape hand back to the step", async () => {
    const view = await show(server(DRAFT).ports, false);
    const close = [...document.querySelectorAll("dialog button")].find((b) => b.textContent === t.dialogClose) as HTMLButtonElement;
    await act(async () => close.click());
    expect(view.onClose).toHaveBeenCalledTimes(1);
    await act(async () => { document.querySelector("dialog")?.dispatchEvent(new Event("cancel", { cancelable: true })); });
    expect(view.onClose).toHaveBeenCalledTimes(2);
  });
});
