// @vitest-environment jsdom
// F4-NAS-R09: the review before publishing shows "Ovako će student vidjeti obavijest", built from the form.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { HostContext, type HostValue } from "../../context";
import { noticePreviewHr as text } from "../publish/messages.hr";
import AssignmentForm from "./AssignmentForm";
import { assignmentFormHr as f } from "./messages.hr";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const HOST = { base: "/app/web", page: { path: "/nastavnik" }, role: "teacher" } as unknown as HostValue;
const course = { id: "c1", name: "Izmišljeni kolegij", academicYear: "2026./2027.", aiPolicy: "partially_allowed" } as const;

describe("AssignmentForm review: the student's notice (F4-NAS-R09)", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });

  const typeInto = async (el: HTMLInputElement, value: string) => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  const click = async (el: Element) => { await act(async () => { (el as HTMLElement).click(); }); };
  const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === label)!;
  async function toReview(extra: (host: HTMLElement) => Promise<void> = async () => {}) {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(h(HostContext.Provider, { value: HOST }, h(AssignmentForm, { course, loadGroups: async () => ({ kind: "ready", groups: [] }) } as never)));
    });
    await typeInto([...host.querySelectorAll("input")].find((i) => i.maxLength === 160)!, "Izmišljeni seminar");
    const when = host.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]');
    await typeInto(when[0]!, "2027-01-10T10:00");
    await typeInto(when[1]!, "2027-01-30T16:00");
    await extra(host);
    await click(button(f.review));
  }
  const line = (label: string) => [...document.querySelectorAll("section[aria-labelledby=np-h] dt")].find((dt) => dt.textContent === label)?.nextElementSibling?.textContent;

  it("is not shown on the form, only in the review", async () => {
    await toReview(async () => { expect(document.querySelector("section[aria-labelledby=np-h]")).toBeNull(); });
    expect(document.querySelector("#np-h")?.textContent).toBe(text.title);
  });

  it("shows the entered deadline in Zagreb time, the allowed use and the word range", async () => {
    await toReview(async (host) => {
      const words = [...host.querySelectorAll<HTMLInputElement>('input[inputmode="numeric"]')];
      await typeInto(words[0]!, "1000");
      await typeInto(words[1]!, "2000");
    });
    expect(line(text.due)).toBe("30. 1. 2027. u 16:00");
    expect(line(text.scope)).toContain("1");
    expect(line(text.scope)).not.toBe(text.noLimit);
    expect(line(text.tools)).toContain(text.toolsSome(""));
    expect(line(text.version)).toBe("1");
  });

  it("says no assistant and no limit when the teacher allows none", async () => {
    await toReview(async () => { await click(document.querySelector<HTMLInputElement>('input[name="ai"][value="none"]')!); });
    expect(line(text.tools)).toBe(text.toolsNone);
    expect(line(text.scope)).toBe(text.noLimit);
  });

  it("is built from what the form holds: going back and changing the deadline changes the notice", async () => {
    await toReview();
    await click(button(f.backToForm));
    const when = document.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]');
    await typeInto(when[1]!, "2027-02-15T09:30");
    await click(button(f.review));
    expect(line(text.due)).toBe("15. 2. 2027. u 9:30");
  });
});
