// @vitest-environment jsdom
import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EventDispute, type EventDisputeLabels, type EventDisputeMark, type EventDisputeResult } from "./EventDispute";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const labels: EventDisputeLabels = {
  supplementAction: "Dopuni opis", disputeAction: "Ospori opis", supplementTitle: "Dopuni opis događaja",
  disputeTitle: "Ospori opis događaja", supplementMark: "Dopuna", disputeMark: "Osporavanje", field: "Tvoj tekst",
  hint: "Opis ostaje kakav jest.", counter: "{used} od {max} znakova", send: "Pošalji", sending: "Slanje…", cancel: "Odustani",
  marksLabel: "Dopune i osporavanja", sent: "Tekst je poslan.", empty: "Nema.", tooLong: "Predug.", invalid: "Nije prihvaćeno.",
  forbidden: "Ne možeš poslati.", signedOut: "Sesija je istekla.", unavailable: "Nedostupno.",
};

// jsdom has no modal <dialog>: a minimal stand-in so the shared Dialog runs as in a browser.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };

describe("EventDispute", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });
  const mount = (props: { marks?: readonly EventDisputeMark[]; canAct?: boolean; onSubmit?: (k: "supplement" | "dispute", t: string) => Promise<EventDisputeResult> }) => {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() => root?.render(<EventDispute labels={labels} marks={props.marks ?? []} canAct={props.canAct ?? true} max={1000}
      onSubmit={props.onSubmit ?? (async () => "ok")} />));
    return host;
  };
  const type = (el: HTMLTextAreaElement, value: string) => {
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    act(() => { set?.call(el, value); el.dispatchEvent(new Event("input", { bubbles: true })); });
  };
  const button = (name: string) => [...document.querySelectorAll("button")].find((b) => b.textContent === name) as HTMLButtonElement;
  const field = () => document.querySelector("textarea") as HTMLTextAreaElement;
  const click = async (b: HTMLButtonElement) => { await act(async () => { b.click(); }); };

  it("empty state: two actions, no marks list", () => {
    const host = mount({});
    expect(host.querySelector("ul")).toBeNull();
    expect(button("Dopuni opis")).toBeDefined();
    expect(button("Ospori opis")).toBeDefined();
  });

  it("shows existing marks as separate tags with their text", () => {
    const host = mount({ marks: [{ id: "1", kind: "supplement", text: "Pisala sam u knjižnici." }, { id: "2", kind: "dispute", text: "Ovo nije točno." }] });
    const items = [...host.querySelectorAll("li")].map((li) => li.textContent);
    expect(items).toEqual(["DopunaPisala sam u knjižnici.", "OsporavanjeOvo nije točno."]);
  });

  it("teacher sees the marks and no action", () => {
    const host = mount({ canAct: false, marks: [{ id: "1", kind: "dispute", text: "Tekst." }] });
    expect(host.querySelector("li")).not.toBeNull();
    expect(host.querySelectorAll("button")).toHaveLength(0);
  });

  it("send: the kind and text go to onSubmit, the dialog closes and the focus returns to the action", async () => {
    const onSubmit = vi.fn(async () => "ok" as const);
    mount({ onSubmit });
    const action = button("Ospori opis");
    action.focus();
    await click(action);
    expect(document.querySelector("dialog")).not.toBeNull();
    expect(document.activeElement).toBe(field());
    type(field(), "Nisam bila odsutna.");
    await click(button("Pošalji"));
    expect(onSubmit).toHaveBeenCalledWith("dispute", "Nisam bila odsutna.");
    expect(document.querySelector("dialog")).toBeNull();
    expect(document.activeElement).toBe(action);
    expect(document.querySelector("[role=status]")?.textContent).toBe("Tekst je poslan.");
  });

  it.each([["forbidden", "Ne možeš poslati."], ["invalid", "Nije prihvaćeno."], ["unavailable", "Nedostupno."], ["signedOut", "Sesija je istekla."]] as const)(
    "answer %s: the dialog stays open with the message and the text kept", async (result, message) => {
      mount({ onSubmit: async () => result });
      await click(button("Dopuni opis"));
      type(field(), "Moj tekst.");
      await click(button("Pošalji"));
      expect(document.querySelector("dialog")).not.toBeNull();
      expect(document.querySelector("[role=alert]")?.textContent).toBe(message);
      expect(field().value).toBe("Moj tekst.");
    });

  it("a blank text and a text over the limit never reach onSubmit", async () => {
    const onSubmit = vi.fn(async () => "ok" as const);
    mount({ onSubmit });
    await click(button("Dopuni opis"));
    type(field(), "   ");
    await click(button("Pošalji"));
    expect(document.querySelector("[role=alert]")?.textContent).toBe("Nije prihvaćeno.");
    type(field(), "a".repeat(1001));
    await click(button("Pošalji"));
    expect(document.querySelector("[role=alert]")?.textContent).toBe("Predug.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("the counter counts code points of the one text and shows no total or score", async () => {
    mount({});
    await click(button("Dopuni opis"));
    type(field(), "čšž😀");
    expect(document.querySelector("dialog")?.textContent).toContain("4 od 1000 znakova");
    expect(document.querySelector("dialog")?.textContent).not.toMatch(/ukupno|bod|%/i);
  });

  it("Escape closes the dialog by keyboard and the focus returns to the action", async () => {
    mount({});
    const action = button("Dopuni opis");
    action.focus();
    await click(action);
    const dialog = document.querySelector("dialog") as HTMLDialogElement;
    await act(async () => { dialog.dispatchEvent(new Event("cancel", { cancelable: true, bubbles: true })); });
    expect(document.querySelector("dialog")).toBeNull();
    expect(document.activeElement).toBe(action);
  });

  it("the open dialog and the marks have no axe violation", async () => {
    const host = mount({ marks: [{ id: "1", kind: "supplement", text: "Tekst." }] });
    await click(button("Dopuni opis"));
    const result = await axe.run(host, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(result.violations).toEqual([]);
  });
});
