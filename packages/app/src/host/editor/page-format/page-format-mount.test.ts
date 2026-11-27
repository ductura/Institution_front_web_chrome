// @vitest-environment jsdom
// F4-PM1-R12A (PM1-93, PM2-45): "Oblik stranice" is reached from the Prikaz menu of the real student toolbar and
// shows the read-only page format of the work's rule profile. Invented profiles only.
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/editor/LocalDocument", () => ({ useLocalEditor: () => null }));

import { pagesMessages as t } from "@/components/editor/pages/messages.hr";
import { profileById } from "../rules/profiles";
import { StudentToolbar } from "../toolbar/StudentToolbar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  document.body.innerHTML = "";
});

const click = (el: Element | undefined) => { if (!el) throw new Error("missing element"); act(() => { (el as HTMLElement).click(); }); };
const byText = (text: string, sel = "button, [role=menuitem]") => [...document.querySelectorAll(sel)].find((e) => e.textContent?.trim().startsWith(text));

function openPageFormat(props: Record<string, unknown> = {}) {
  const host = document.body.appendChild(document.createElement("div"));
  act(() => { createRoot(host).render(createElement(StudentToolbar, { workPartsKey: "k", ...props })); });
  expect(document.querySelector("dialog[open]")).toBeNull();
  click(byText("Prikaz", "button"));
  click(byText(t.formatTitle, "[role=menuitem], [role=menu] button, li, button"));
  return document.querySelector("dialog[open]");
}

describe("page format in the student toolbar", () => {
  it("opens from Prikaz with the profile's values and the rule they come from", () => {
    const dialog = openPageFormat({ skeletonProfile: profileById("df-diplomski") });
    expect(dialog?.textContent).toContain(t.formatTitle);
    expect(dialog?.textContent).toContain("Fakultet društvenih znanosti Primjer – diplomski rad");
    expect(dialog?.textContent).toContain(t.fromRules);
    expect(dialog?.textContent).toContain("Rimski i arapski brojevi stranica od Uvoda");
    // Read only: nothing to type into, only the close button.
    expect(dialog?.querySelectorAll("input, textarea, select")).toHaveLength(0);
  });

  it("without a profile shows the general academic work, marked as general values", () => {
    const dialog = openPageFormat();
    expect(dialog?.textContent).toContain("Fakultet društvenih znanosti Primjer – opći akademski rad");
    expect(dialog?.textContent).toContain(t.general);
    expect(dialog?.textContent).not.toContain(t.fromRules);
  });

  it("closes with Zatvori", () => {
    const dialog = openPageFormat();
    click([...(dialog?.querySelectorAll("button") ?? [])].find((b) => b.textContent === t.close));
    expect(document.querySelector("dialog[open]")).toBeNull();
  });
});
