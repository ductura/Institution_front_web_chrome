// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { WhatsNewCard } from "./AssistCards";
import type { Change } from "./since-last";

// MEN-R12: invented chapters only.
const chapter = (id: string, title: string) => ({ id, level: 1, number: "1", title, text: "", words: 0, cites: 0, parentId: null, empty: true });
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(changes: Change[], onGo: (id: string) => void) {
  const el = document.createElement("div");
  act(() => { createRoot(el).render(createElement(WhatsNewCard, { changes, onGo })); });
  return el;
}

describe("WhatsNewCard", () => {
  it("renders nothing when nothing changed", () => {
    expect(render([], vi.fn()).querySelector("[data-whats-new]")).toBeNull();
  });
  it("lists changes and jumps to the chapter on click", () => {
    const onGo = vi.fn();
    const el = render([{ chapter: chapter("b", "Okvir"), kind: "grown", delta: 30 }, { chapter: chapter("c", "Zaključak"), kind: "added", delta: 40 }], onGo);
    expect(el.textContent).toContain("Što je novo od zadnje sesije");
    expect(el.textContent).toContain("Okvir: 30 riječi više");
    expect(el.textContent).toContain("Novo poglavlje Zaključak (40 riječi)");
    act(() => { el.querySelector<HTMLButtonElement>("li button")?.click(); });
    expect(onGo).toHaveBeenCalledWith("b");
  });
  it("is mounted in the writing help, not only here", () => {
    const src = readFileSync(resolve(process.cwd(), "src/host/editor/left/LeftSectionsHost.tsx"), "utf8");
    expect(src).toContain("<WhatsNewCard");
    expect(src).toContain("<ResumeCard");
  });
});
