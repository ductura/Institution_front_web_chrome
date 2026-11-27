// @vitest-environment jsdom
// PIL-K-IZJAVA: DeclarationStep rendered on the real step ports over a recorded server. Invented data only.
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApi } from "../../../../../../../src/client/api.ts";
import DeclarationStep from "./DeclarationStep";
import { declarationStepText as t } from "./messages.hr";
import { createStepPorts } from "./step-ports";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const mirror = vi.fn();
vi.mock("../../../../../../../src/components/predaja/Declaration.tsx", () => ({ useSessionTag: () => "tag-1", writeConfirmed: (...args: unknown[]) => mirror(...args) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ASSIGNMENT = "00000000-0000-4000-8000-0000000000a1";
const FORM = { formId: "test-izjava", formVersion: 1, formSha256: "a".repeat(64) };
const DRAFT = {
  baseVersion: 3, revision: 2, form: FORM, ownWork: { confirmed: false },
  humanHelp: { received: false, entries: [] },
  ai: { use: "not_used", declaredTools: [], attachments: [], externalAttachmentIds: [] },
  confirm: false,
};
const STATE = {
  state: "draft", submitted: false, currentRevision: 2, version: 4, formText: "Izmišljeni obrazac.",
  currentForm: { ...FORM, text: "Izmišljeni obrazac." }, draft: DRAFT as typeof DRAFT | null,
  payload: null, declarationSha256: null, uploads: [],
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const error = (status: number, code: string) => json(status, { error: code, code, messageKey: "errors.x", status, requestId: "00000000-0000-4000-8000-000000000000" });

/** A server holding one declaration; `answer` decides each PUT (default: accept on the current version). */
function server(start: typeof STATE, answer?: () => Promise<Response> | Response) {
  let state = { ...start };
  const puts: unknown[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    // F4-PRE-R02: the assistant's list of conversations; none here.
    if (String(input).includes("/assistant-conversations")) return json(200, { assignmentId: ASSIGNMENT, conversations: [] });
    if ((init?.method ?? "GET") === "GET") return json(200, state);
    const body = JSON.parse(String(init?.body)) as { confirm: boolean };
    puts.push(body);
    if (answer) return answer();
    state = { ...state, version: state.version + 1, state: body.confirm ? "confirmed" : "draft" };
    return json(200, state);
  };
  return { puts, hold: (next: typeof STATE) => { state = next; }, ports: createStepPorts(createApi({ baseUrl: "https://ductura.example.invalid", fetchImpl })) };
}

let root: Root | null = null;
let host: HTMLElement | null = null;

const settle = () => act(async () => { for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0)); });

async function show(ports: ReturnType<typeof createStepPorts>) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(createElement(DeclarationStep, { assignmentId: ASSIGNMENT, workState: "in_progress", ports, hrefOf: (p: string) => p, onSignIn: () => undefined }));
  });
  await settle();
  const box = () => host!.querySelector<HTMLInputElement>("#sb-confirm")!;
  const next = () => [...host!.querySelectorAll("button")].find((b) => b.textContent === t.next)!;
  const lines = (role: string) => [...host!.querySelectorAll(`[role=${role}]`)].map((el) => el.textContent);
  return { box, next, lines };
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  push.mockReset();
  mirror.mockReset();
});

describe("DeclarationStep on declaration-v1 (PIL-K-IZJAVA)", () => {
  it("a declaration that is not filled in cannot be confirmed: the box is off and nothing is sent", async () => {
    const s = server({ ...STATE, draft: null });
    const view = await show(s.ports);
    expect(host!.textContent).toContain(t.emptyDeclared);
    expect(view.box().disabled).toBe(true);
    expect(host!.textContent).toContain(t.fillFirst);
    await act(async () => view.box().click());
    await settle();
    expect(s.puts).toEqual([]);
    expect(view.next().getAttribute("aria-disabled")).toBe("true");
  });

  it("click → PUT → 'Dalje': checked only once the server holds it, never ahead of its answer", async () => {
    let release: (r: Response) => void = () => undefined;
    const s = server(STATE, () => new Promise<Response>((resolve) => { release = resolve; }));
    const view = await show(s.ports);
    expect(view.box().disabled).toBe(false);
    expect(view.next().getAttribute("aria-disabled")).toBe("true");

    await act(async () => view.box().click());
    await settle();
    expect(s.puts).toHaveLength(1);
    expect(s.puts[0]).toMatchObject({ baseVersion: 4, confirm: true });
    // While the server has not answered: not checked, not open, and the box takes no second click.
    expect(view.box().checked).toBe(false);
    expect(view.box().disabled).toBe(true);
    expect(view.lines("status")).toContain(t.confirming);
    expect(view.next().getAttribute("aria-disabled")).toBe("true");

    const held = { ...STATE, state: "confirmed", version: 5 };
    s.hold(held);
    await act(async () => release(json(200, held)));
    await settle();
    expect(view.box().checked).toBe(true);
    expect(view.next().getAttribute("aria-disabled")).toBeNull();
    expect(mirror).toHaveBeenLastCalledWith(expect.any(String), true);
    await act(async () => view.next().click());
    expect(push).toHaveBeenCalledWith(`/rad/${ASSIGNMENT}/predaja/pregled?izjava=tag-1`);
  });

  it("a technical failure stays as an alert, is never shown as saved and does not open 'Dalje'", async () => {
    const s = server(STATE, () => error(503, "unavailable"));
    const view = await show(s.ports);
    await act(async () => view.box().click());
    await settle();
    expect(view.lines("alert")).toContain(t.confirmTechnical);
    expect(view.box().checked).toBe(false);
    expect(view.next().getAttribute("aria-disabled")).toBe("true");
    expect(mirror).not.toHaveBeenCalledWith(expect.any(String), true);
    await act(async () => view.next().click());
    expect(push).not.toHaveBeenCalled();
  });

  it("a refusal and a conflict are alerts too; a conflict reads the declaration again", async () => {
    const refused = server(STATE, () => error(409, "incomplete"));
    let view = await show(refused.ports);
    await act(async () => view.box().click());
    await settle();
    expect(view.lines("alert")).toContain(t.confirmRefused);
    expect(view.next().getAttribute("aria-disabled")).toBe("true");
    act(() => root?.unmount());
    host?.remove();

    const conflict = server(STATE, () => error(409, "declaration_conflict"));
    view = await show(conflict.ports);
    await act(async () => view.box().click());
    await settle();
    expect(view.lines("alert")).toContain(t.conflict);
    expect(view.box().checked).toBe(false);
  });

  it("a read the server cannot give leaves nothing to confirm", async () => {
    const fetchImpl: typeof fetch = async () => error(503, "unavailable");
    const view = await show(createStepPorts(createApi({ baseUrl: "https://ductura.example.invalid", fetchImpl })));
    expect(view.lines("alert")).toContain(t.error);
    expect(view.box().disabled).toBe(true);
    expect(view.next().getAttribute("aria-disabled")).toBe("true");
  });
});

describe("NF-3 PR-4: an honest empty state on E-9", () => {
  it("nothing recorded: the block says so, explains what it holds and offers no dead element", async () => {
    await show(server(STATE).ports);
    const text = host!.textContent ?? "";
    expect(text).toContain("U ovom radu nije zabilježen razgovor s Asistentom.");
    expect(text).toContain("Ovdje se bilježi ono što napravi sama Ductura, uključujući razgovore s Asistentom. Alate izvan Ducture navedite u „Vašoj izjavi”.");
    expect(text).toContain("Nema razgovora za prilaganje.");
    // No "Dodaj objašnjenje", no teacher's question and no "Prilozi" list the contract cannot fill.
    expect(text).not.toContain("Dodaj objašnjenje");
    expect(text).not.toContain(t.question);
    expect(text).not.toContain(t.attachments);
    // Q-10: no provider and no model anywhere on the step.
    expect(text).not.toMatch(/AI pomoćnik|model/iu);
  });
});
