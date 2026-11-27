// @vitest-environment jsdom
// ED-80 (prototype assist2.js `AX.preSend`): a question with personal data is not sent until the
// student chooses: remove them and send, send anyway, or go back to the field. The notice and the
// port are fakes; every address and number is invented.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../assistant-rules/assistant-rules", () => ({
  useAssignmentNotice: () => ({ kind: "available", readAt: null, view: { aiPolicy: "allowed", aiPurposes: ["proofreading"] } }),
}));

import { AssistantChatView } from "./AssistantChat";
import type { AssistantPort } from "./assistant-chat";
import { assistantChatHr as t } from "./messages.hr";
import { REMOVED } from "./personal-data";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ASSIGNMENT = "0f0e0d0c-0b0a-4908-8706-050403020180";
const QUESTION = "Provjeri rečenicu: javite se na ana@primjer.hr ili 091 234 5678.";

describe("ED-80 Asistent: personal data before sending", () => {
  let root: Root | undefined;
  let scopes = 0;
  afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.innerHTML = ""; });

  const mount = async () => {
    const asked: string[] = [];
    const port: AssistantPort = {
      ask: async (input) => { asked.push(input.paragraph); return { kind: "answered", conversationId: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c80" }; },
      read: async () => ({ kind: "unavailable" }),
      availability: async () => ({ kind: "unavailable" }),
      remaining: async () => ({ kind: "unavailable" }),
      conversations: async () => ({ kind: "unavailable" }),
    };
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    scopes += 1;
    await act(async () => { root?.render(h(AssistantChatView, { assignmentId: ASSIGNMENT, scope: String(scopes).repeat(64).slice(0, 64), readOnly: false, port })); });
    const field = host.querySelector("textarea")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, QUESTION);
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => { host.querySelector("form")!.requestSubmit(); });
    return { host, field, asked };
  };
  const card = (host: HTMLElement) => host.querySelector<HTMLElement>("[data-personal-data]");
  const press = async (host: HTMLElement, label: string) => {
    const button = [...card(host)!.querySelectorAll("button")].find((b) => b.textContent === label)!;
    await act(async () => { button.click(); });
  };

  it("holds the question and names what it found, with the title focused", async () => {
    const { host, asked } = await mount();
    const group = card(host)!;
    expect(asked).toEqual([]);
    expect(group.getAttribute("role")).toBe("group");
    const title = document.getElementById(group.getAttribute("aria-labelledby")!)!;
    expect(title.textContent).toBe(t.pii.title);
    expect(document.activeElement).toBe(title);
    expect(group.textContent).toContain("E-adresa: ana@primjer.hr; Broj telefona: 091 234 5678. Pružatelju ih ne treba slati.");
  });

  it("Ukloni ih i pošalji sends the cleaned question and puts it in the field", async () => {
    const { host, asked } = await mount();
    await press(host, t.pii.cut);
    const cleaned = `Provjeri rečenicu: javite se na ${REMOVED} ili ${REMOVED}.`;
    expect(asked).toEqual([cleaned]);
    expect(card(host)).toBeNull();
  });

  it("Pošalji svejedno sends the question as it is", async () => {
    const { host, asked } = await mount();
    await press(host, t.pii.go);
    expect(asked).toEqual([QUESTION]);
    expect(card(host)).toBeNull();
  });

  it("Odustani sends nothing and returns to the field", async () => {
    const { host, field, asked } = await mount();
    await press(host, t.pii.cancel);
    expect(asked).toEqual([]);
    expect(card(host)).toBeNull();
    expect(document.activeElement).toBe(field);
    expect(field.value).toBe(QUESTION);
  });
});
