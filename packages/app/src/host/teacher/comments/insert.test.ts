// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import TeacherCommentsPanel, { type BankInsertion } from "./TeacherCommentsPanel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;
const ANCHOR = { nodeId: "n1", quote: "izmišljeni navod", prefix: "", suffix: "", startHint: 0, endHint: 16 };

const render = async (insert: BankInsertion | null, draft: typeof ANCHOR | null = ANCHOR) => {
  host ??= document.body.appendChild(document.createElement("div"));
  root ??= createRoot(host);
  await act(async () => {
    root!.render(createElement(TeacherCommentsPanel, {
      documentId: "d1", outcome: { kind: "ok", threads: [] }, placed: [], nodeOrder: [], draft: draft as never, revision: 1,
      current: () => true, insert, onReload: () => undefined, onDraftDone: () => undefined, onShow: () => undefined,
    }));
  });
};
const field = () => host!.querySelector("form textarea") as HTMLTextAreaElement | null;
const type = async (value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  await act(async () => { setter.call(field(), value); field()!.dispatchEvent(new Event("input", { bubbles: true })); });
};

afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; });

describe("bank insertion into the new comment (WEB-V17-BANK-INSERT)", () => {
  it("puts a bank text into the comment field, and the same text again on a new insertion", async () => {
    await render(null);
    await render({ n: 1, text: "Navedite izvor." });
    expect(field()!.value).toBe("Navedite izvor.");
    await type("Moj uvod.");
    await render({ n: 2, text: "Navedite izvor." });
    expect(field()!.value).toBe("Moj uvod.\n\nNavedite izvor.");
  });

  it("does not apply an insertion that was already there when the form opened", async () => {
    await render({ n: 5, text: "Stari unos" }, null);
    await render({ n: 5, text: "Stari unos" });
    expect(field()!.value).toBe("");
  });

  it("does not re-apply the same insertion on a later render", async () => {
    await render(null);
    await render({ n: 1, text: "Jedan" });
    await type("");
    await render({ n: 1, text: "Jedan" });
    expect(field()!.value).toBe("");
  });
});
