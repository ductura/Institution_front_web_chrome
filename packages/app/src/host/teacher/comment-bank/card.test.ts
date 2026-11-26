// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import CommentBank from "./CommentBank";
import { fakeCommentBankPort, fakeDraftCommentsPort } from "./fake-port";
import { commentBankMessages as text } from "./messages.hr";
import type { CommentBankPort, DraftAnchor } from "./model";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;
const ANCHOR: DraftAnchor = { nodeId: "n", quote: "q", prefix: "", suffix: "", startHint: 0, endHint: 1 };

async function show(bank: CommentBankPort, anchor: DraftAnchor | null = ANCHOR, onInsert?: (text: string) => void) {
  const drafts = fakeDraftCommentsPort();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(createElement(CommentBank, { assignmentId: "d1", drafts, bank, anchor, onInsert })); });
  return drafts;
}
const click = async (label: string) => {
  const button = [...host!.querySelectorAll("button")].find((b) => b.textContent === label);
  if (!button) throw new Error(`no button ${label}`);
  await act(async () => { button.click(); });
};
const items = () => [...host!.querySelectorAll("li")].map((li) => li.textContent ?? "");

afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; });

describe("CommentBank card (WEB-1704)", () => {
  it("keeps a bank entry listed until the server confirms the removal", async () => {
    const base = fakeCommentBankPort();
    let answer: "unknown" | "removed" = "unknown";
    await show({ ...base, remove: async (id) => (answer === "removed" ? base.remove(id) : { kind: "unknown" }) });
    const before = items().length;
    await click(text.remove);
    expect(items().length).toBe(before);
    expect(host!.textContent).toContain(text.unknown);
    answer = "removed";
    await click(text.remove);
    expect(items().length).toBe(before - 1);
  });

  it("offers no draft without a selected text", async () => {
    await show(fakeCommentBankPort(), null);
    expect(host!.textContent).toContain(text.needAnchor);
    expect([...host!.querySelectorAll("button")].find((b) => b.textContent === text.saveDraft)?.disabled).toBe(true);
  });

  it("filters the list by kind and by search text", async () => {
    await show(fakeCommentBankPort());
    expect(items().filter((t) => t.includes("Navedite izvor"))).toHaveLength(1);
    const select = [...host!.querySelectorAll("select")].find((el) => el.closest("li") === null && el.labels?.[0]?.textContent === text.kindFilter)!;
    await act(async () => { select.value = "sugg"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(host!.textContent).toContain("Odlomak bi bio jasniji");
    expect(host!.textContent).not.toContain("Navedite izvor");
    const search = host!.querySelector("input[type=search]") as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => { setter.call(search, "zaključak"); search.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(host!.textContent).toContain(text.noMatch);
  });

  it("inserts an entry into the comment only with a marked passage", async () => {
    const inserted: string[] = [];
    await show(fakeCommentBankPort(), ANCHOR, (t) => inserted.push(t));
    await click(text.insert);
    expect(inserted).toEqual(["Navedite izvor ove tvrdnje."]);
  });

  it("offers no insertion without a marked passage", async () => {
    const inserted: string[] = [];
    await show(fakeCommentBankPort(), null, (t) => inserted.push(t));
    const button = [...host!.querySelectorAll("button")].find((b) => b.textContent === text.insert)!;
    expect(button.disabled).toBe(true);
    await act(async () => { button.click(); });
    expect(inserted).toEqual([]);
  });

  it("changes an entry's text and label only after the server confirmed", async () => {
    const base = fakeCommentBankPort();
    let answer: "unknown" | "ok" = "unknown";
    await show({ ...base, update: async (id, input) => (answer === "ok" ? base.update(id, input) : { kind: "unknown" }) });
    await click(text.edit);
    const textarea = host!.querySelector("[role=group] textarea") as HTMLTextAreaElement;
    const setText = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    await act(async () => { setText.call(textarea, "Izmijenjeni izmišljeni tekst"); textarea.dispatchEvent(new Event("input", { bubbles: true })); });
    await click(text.saveEntry);
    expect(host!.textContent).toContain(text.unknown);
    // Not confirmed: the form stays open and the entry is not changed.
    expect(host!.querySelector("[role=group]")).not.toBeNull();
    const shown = [...host!.querySelectorAll("li")].filter((li) => !li.querySelector("[role=group]")).map((li) => li.textContent ?? "");
    expect(shown.some((t) => t.includes("Izmijenjeni izmišljeni tekst"))).toBe(false);
    answer = "ok";
    await click(text.saveEntry);
    expect(items().some((t) => t.includes("Izmijenjeni izmišljeni tekst"))).toBe(true);
    expect(items().some((t) => t.includes("Navedite izvor"))).toBe(false);
    expect(host!.textContent).toContain(text.entryUpdated);
    expect(host!.querySelector("[role=group]")).toBeNull();
  });

  it("drops an entry the server no longer has for this teacher (404) and says so", async () => {
    const base = fakeCommentBankPort();
    await show({ ...base, update: async () => ({ kind: "gone" }) });
    await click(text.edit);
    await click(text.saveEntry);
    expect(host!.textContent).toContain(text.entryGone);
    expect(items().some((t) => t.includes("Navedite izvor"))).toBe(false);
  });

  it("shows why a blank entry is not sent and sends nothing", async () => {
    const base = fakeCommentBankPort();
    let sent = 0;
    await show({ ...base, save: async (input) => { sent += 1; return base.save(input); } });
    await click(text.add);
    await click(text.saveEntry);
    expect(host!.textContent).toContain(text.inputErrors.emptyText);
    expect(sent).toBe(0);
  });
});
