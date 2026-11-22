// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { createFakeEventDisputes } from "../../../../../../src/client/event-disputes";
import { EventDisputeSlot, EventDisputesProvider } from "./EventDisputes";

HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("event dispute slot in a host", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });
  const mount = async (port: ReturnType<typeof createFakeEventDisputes>, role: "student" | "teacher") => {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(h(EventDisputesProvider, { port, documentId: "d1", children: [
        h("p", { key: "p" }, "Opis događaja"),
        h(EventDisputeSlot, { key: "1", eventId: "e1", role }),
        h(EventDisputeSlot, { key: "2", eventId: "e2", role })] }));
    });
    return host;
  };

  it("shows the read marks under their own event only, the description stays", async () => {
    const port = createFakeEventDisputes({ d1: [{ id: "00000000-0000-4000-8000-000000000001", eventId: "e2", kind: "dispute", text: "Izmišljeno osporavanje.", createdWindow: "2026-11-20T10:00:00.000Z" }] });
    const host = await mount(port, "student");
    expect(host.textContent).toContain("Opis događaja");
    expect(host.querySelectorAll("li")).toHaveLength(1);
    expect(host.textContent).toContain("Izmišljeno osporavanje.");
  });

  it("the teacher sees the marks and no action", async () => {
    const port = createFakeEventDisputes({ d1: [{ id: "00000000-0000-4000-8000-000000000001", eventId: "e1", kind: "supplement", text: "Dopuna.", createdWindow: "2026-11-20T10:00:00.000Z" }] });
    const host = await mount(port, "teacher");
    expect(host.querySelectorAll("li")).toHaveLength(1);
    expect(host.querySelectorAll("button")).toHaveLength(0);
  });

  it("a failed read is said once and the student can still try to write", async () => {
    const host = await mount(createFakeEventDisputes({}, { fail: "unavailable" }), "student");
    expect(host.textContent).toContain("trenutačno nije moguće učitati");
    expect(host.querySelectorAll("button").length).toBeGreaterThan(0);
  });

  it("a sent text appears as a mark under its event and goes through the port with the event id", async () => {
    const port = createFakeEventDisputes();
    const host = await mount(port, "student");
    const open = host.querySelectorAll("button")[0] as HTMLButtonElement;
    await act(async () => { open.click(); });
    const area = document.querySelector("textarea") as HTMLTextAreaElement;
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    act(() => { set?.call(area, "Moja dopuna."); area.dispatchEvent(new Event("input", { bubbles: true })); });
    const send = [...document.querySelectorAll("button")].find((b) => b.textContent === "Pošalji") as HTMLButtonElement;
    await act(async () => { send.click(); });
    expect(port.sent).toEqual([{ documentId: "d1", eventId: "e1", kind: "supplement", text: "Moja dopuna." }]);
    expect(host.querySelectorAll("li")).toHaveLength(1);
  });
});
