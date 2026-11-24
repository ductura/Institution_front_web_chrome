// @vitest-environment jsdom
// PIL-K-IZJAVA-VRATA: step 3 opens "Dalje" only on the server's declaration, never on this browser's.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { confirmationKey } from "../../../../../../../src/components/predaja/flow.ts";
import BeforeSubmitStep from "./BeforeSubmitStep";
import { ASSIGNMENT, CONFIRMED, DRAFT, gateServer } from "./declaration-gate.fixture";
import { checksText as c } from "./messages.hr";
import { rehearsalMessagesHr as r } from "../../../../../../../src/components/editor/submission-rehearsal/messages.hr.ts";

const push = vi.fn();
const router = { push };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../../../../../../../src/client/online-status.ts", () => ({ useOnline: () => true }));
// The summary, notes and marks are not this test's: they never answer.
vi.mock("../../../../../../../src/components/student/Submission.tsx", () => ({ readWork: () => new Promise(() => undefined) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
beforeEach(() => { vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined))); push.mockReset(); });
afterEach(() => { act(() => root?.unmount()); root = null; document.body.innerHTML = ""; window.sessionStorage.clear(); vi.unstubAllGlobals(); });

async function mount(read: ReturnType<typeof gateServer>["read"], declaredFor?: string) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(h(BeforeSubmitStep, {
      assignmentId: ASSIGNMENT, stage: { kind: "open" } as never, declaredFor, hrefOf: (p: string) => p, workHref: "/rad/x",
      onSignIn: () => undefined, declarationGate: read,
    }));
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return host;
}
const buttons = (host: HTMLElement) => [...host.querySelectorAll("button")].map((b) => b.textContent);

describe("step 3 declaration gate (PIL-K-IZJAVA-VRATA)", () => {
  it("a confirmation kept in sessionStorage or handed over in ?izjava= does not open the next step", async () => {
    window.sessionStorage.setItem(confirmationKey("tag-1", ASSIGNMENT), "1");
    const server = gateServer(() => DRAFT);
    const host = await mount(server.read, "tag-1");
    expect(server.paths).toEqual([`/api/v1/student/assignments/${ASSIGNMENT}/declaration`]);
    // WEB-NUZ-PREDAJA-1 (PR-2): the draft is named as a draft, and "Što još fali" names the confirmation.
    expect(host.textContent).toContain(r.declarationDraft);
    expect(host.textContent).toContain(r.missingDeclaration);
    expect(buttons(host)).not.toContain(c.next);
    expect(buttons(host)).toContain(c.toDeclaration);
  });

  it("a declaration the server holds as confirmed opens the next step", async () => {
    const host = await mount(gateServer(() => CONFIRMED).read);
    expect(host.textContent).toContain(r.declarationConfirmedAt.replace("{at}", "20. 11. 2026. u 11:00"));
    expect(host.textContent).toContain(r.missingNothing);
    expect(buttons(host)).toContain(c.next);
  });

  it("a failed read does not open the next step and offers to read again", async () => {
    let answer: unknown = 503;
    const server = gateServer(() => answer);
    const host = await mount(server.read, "tag-1");
    expect(host.textContent).toContain(c.declarationUnavailable);
    expect(buttons(host)).not.toContain(c.next);
    answer = "offline";
    const retry = [...host.querySelectorAll("button")].find((b) => b.textContent === c.declarationRetry);
    await act(async () => { retry?.click(); await new Promise((r) => setTimeout(r, 0)); });
    expect(server.paths).toHaveLength(2);
    expect(buttons(host)).not.toContain(c.next);
  });
});
