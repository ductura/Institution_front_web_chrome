// @vitest-environment jsdom
// NF-3 PR-13, PR-15 on step 5: the withdrawal card with its reason and next step, and "Moje predaje",
// on one read of the history. Invented data only.
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import vectors from "../../../../../../../src/client/migration-contract-vectors.generated.json" with { type: "json" };
import { ASSIGNMENT, fakeWithdrawServer } from "../withdraw/fake-port";
import AfterSubmission from "./AfterSubmission";
import type { HistoryCall } from "./contract";

const saved = vi.fn();
vi.mock("../../../../../../../src/components/editor/EarlierDraft", () => ({ downloadBlob: (...args: unknown[]) => saved(...args) }));
vi.mock("../../../context", () => ({ useHost: () => ({ base: "/app/web" }) }));
const signIn = vi.fn();
vi.mock("../../../../../../../src/client/api", async (actual) => ({ ...(await actual<object>()), goToSignIn: (...args: unknown[]) => signIn(...args) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };

const HISTORY = (vectors as { route: string; name: string; response: { body: unknown } }[])
  .find((v) => v.route === "student.submission-history.get" && v.name === "history")!.response.body as { events: unknown[] };
const history = (body: unknown): HistoryCall => async () => ({ ok: true, status: 200, body });
const NO_EVENTS = { withdrawalAllowed: true, dueAt: "2099-12-20T22:59:00.000Z", events: [] };

let root: Root | null = null;
let host: HTMLElement | null = null;
const settle = () => act(async () => { for (let i = 0; i < 8; i += 1) await new Promise((r) => setTimeout(r, 0)); });
async function render(props: Partial<Parameters<typeof AfterSubmission>[0]>) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root!.render(createElement(AfterSubmission, {
    assignmentId: ASSIGNMENT, deadline: "2099-12-20T22:59:00.000Z", workHref: "/app/web/rad/a1", receiptHref: "/app/web/rad/a1/predaja/potvrda",
    here: "/app/web/rad/a1/predaja/potvrda", historyCall: () => history(NO_EVENTS), ...props,
  })));
  await settle();
  return host;
}
const text = () => host!.textContent ?? "";
const button = (name: string) => [...host!.querySelectorAll("button")].find((b) => b.textContent === name);
const link = (name: string) => [...host!.querySelectorAll("a")].find((a) => a.textContent === name);

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  saved.mockReset();
  document.querySelectorAll("dialog").forEach((d) => d.remove());
});

describe("Povlačenje predaje with its reason (PR-13)", () => {
  it("shows the deadline beside the button while the server allows it", async () => {
    const server = fakeWithdrawServer();
    await render({ withdrawCall: () => server.call });
    expect(text()).toContain("Dok rok traje, predaju možete povući i predati ponovno. Rok: 20. 12. 2099. u 23:59.");
    expect(button("Povuci predaju")).toBeDefined();
  });

  it("says the teacher or the faculty does not allow it when the history's switch is off", async () => {
    const server = fakeWithdrawServer({ open: false });
    await render({ withdrawCall: () => server.call, historyCall: () => history({ ...NO_EVENTS, withdrawalAllowed: false }) });
    expect(text()).toContain("Nastavnik ili fakultet ne dopušta povlačenje za ovaj zadatak.");
    expect(button("Povuci predaju")).toBeUndefined();
  });

  it("after the withdrawal says what comes next and offers the workspace", async () => {
    const server = fakeWithdrawServer();
    await render({ withdrawCall: () => server.call });
    await act(async () => button("Povuci predaju")!.click());
    const confirm = [...document.querySelectorAll("dialog button")].find((b) => b.textContent === "Povuci predaju") as HTMLButtonElement;
    expect(document.querySelector("dialog")?.textContent).toContain("Rok: 20. 12. 2099. u 23:59.");
    await act(async () => confirm.click());
    await settle();
    expect(host!.querySelector("h2, h3")?.textContent).toBe("Predaja je povučena");
    expect(text()).toContain("Rad možete ponovno mijenjati do 20. 12. 2099. u 23:59. Zatim ga predajte iznova.");
    expect(text()).toContain("Nastavnik u povijesti vidi i predaju i povlačenje.");
    expect(link("Otvori radni prostor")?.getAttribute("href")).toBe("/app/web/rad/a1");
    expect(host!.querySelector("[role=status]")?.textContent).toBe("Predaja je povučena. Potvrdu povlačenja možete preuzeti.");
  });
});

describe("Moje predaje (PR-15)", () => {
  it("lists the attempts, newest first, with the receipt of the one in force and the withdrawal's confirmation", async () => {
    const server = fakeWithdrawServer({ open: false });
    await render({ withdrawCall: () => server.call, historyCall: () => history(HISTORY) });
    const items = [...host!.querySelectorAll("[data-testid=my-submissions] > li")];
    expect(items.map((li) => li.querySelector("p")?.textContent)).toEqual(["Predaja 2 · 20. 12. 2026. u 23:05", "Predaja 1 · 20. 12. 2026. u 22:14"]);
    expect(items[0]!.textContent).toContain("Trenutno važeća predaja.");
    expect(items[0]!.querySelector("a")?.getAttribute("href")).toBe("/app/web/rad/a1/predaja/potvrda");
    expect(items[1]!.textContent).toContain("Povučena 20. 12. 2026. u 22:40.");
    const download = items[1]!.querySelector("button")!;
    expect(download.getAttribute("aria-label")).toBe("Preuzmi potvrdu povlačenja predaje 1");
    await act(async () => download.click());
    expect(saved).toHaveBeenCalledTimes(1);
    expect(saved.mock.calls[0]![1]).toMatch(/^potvrda-povlacenja-.*\.json$/);
  });

  it("says the list cannot be read instead of showing none", async () => {
    const server = fakeWithdrawServer();
    await render({ withdrawCall: () => server.call, historyCall: () => async () => ({ ok: false, status: 503, code: "unavailable" }) });
    expect([...host!.querySelectorAll("[role=alert]")].map((p) => p.textContent)).toContain("Popis predaja trenutačno nije moguće učitati.");
    expect(button("Pokušaj ponovno")).toBeDefined();
  });

  it("shows no list for a work without submissions", async () => {
    await render({ withdrawCall: () => fakeWithdrawServer().call });
    expect(host!.querySelector("[data-testid=my-submissions]")).toBeNull();
    expect(text()).not.toContain("Moje predaje");
  });
});
