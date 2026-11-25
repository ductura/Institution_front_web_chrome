// @vitest-environment jsdom
// WEB-V16-KOSTUR: the frame's behaviour as a user meets it, over stand-in sections. Invented text only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { thesisHr } from "./messages.hr";
import type { SectionRead, SectionViewProps, ThesisSectionDef } from "./model";
import { ThesisPanel } from "./ThesisPanel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
async function mount(node: ReturnType<typeof h>): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(node); });
  return host;
}
afterEach(() => { act(() => root?.unmount()); root = null; document.body.innerHTML = ""; });

const section = (id: string, read: ThesisSectionDef<string>["read"], order = 1): ThesisSectionDef<never> => ({
  id, order, title: `Odjeljak ${id}`, read,
  View: ({ value, role, documentId, reload }: SectionViewProps<string>) => h("div", { "data-testid": `view-${id}` },
    h("span", null, `${value}|${role}|${documentId}`), h("button", { onClick: reload }, "ponovno")),
}) as unknown as ThesisSectionDef<never>;
const answer = (r: SectionRead<string>) => async () => r;
const panel = (sections: ThesisSectionDef<never>[], extra: { inMentorship?: boolean; role?: "student" | "mentor" } = {}) =>
  mount(h(ThesisPanel, { documentId: "izmisljeni-dokument-1", role: extra.role ?? "student", inMentorship: extra.inMentorship, sections }));

describe("ThesisPanel states", () => {
  it("ready: the section's View gets the value, role and document", async () => {
    const host = await panel([section("a", answer({ kind: "ready", value: "vrijednost" }))], { role: "mentor" });
    expect(host.textContent).toContain("Odjeljak a");
    expect(host.querySelector('[data-testid="view-a"] span')?.textContent).toBe("vrijednost|mentor|izmisljeni-dokument-1");
  });

  it("unavailable (and a throwing read) is an error with a working retry, never 'nema zapisa'", async () => {
    const read = vi.fn<ThesisSectionDef<string>["read"]>()
      .mockRejectedValueOnce(new Error("izmišljena greška"))
      .mockResolvedValueOnce({ kind: "ready", value: "nakon" });
    const host = await panel([section("a", read)]);
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(thesisHr.unavailable);
    expect(host.textContent).not.toContain(thesisHr.empty);
    const retry = [...host.querySelectorAll("button")].find((b) => b.textContent === thesisHr.retry)!;
    expect(retry).toBeTruthy();
    await act(async () => { retry.click(); });
    expect(read).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[data-testid="view-a"] span')?.textContent).toContain("nakon");
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it("empty shows the empty text, not an error", async () => {
    const host = await panel([section("a", answer({ kind: "empty" }))]);
    expect(host.textContent).toContain(thesisHr.empty);
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it("loading shows a busy card first, before the read settles", async () => {
    let release: (r: SectionRead<string>) => void = () => undefined;
    const host = await panel([section("a", () => new Promise((res) => { release = res; }))]);
    expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(host.textContent).not.toContain(thesisHr.empty);
    await act(async () => { release({ kind: "empty" }); });
    expect(host.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it("a View's reload reads the section again", async () => {
    const read = vi.fn<ThesisSectionDef<string>["read"]>().mockResolvedValue({ kind: "ready", value: "x" });
    const host = await panel([section("a", read)]);
    await act(async () => { (host.querySelector('[data-testid="view-a"] button') as HTMLButtonElement).click(); });
    expect(read).toHaveBeenCalledTimes(2);
  });
});

describe("ThesisPanel visibility (work without a mentorship)", () => {
  it("every section notFound hides the whole panel", async () => {
    const host = await panel([section("a", answer({ kind: "notFound" })), section("b", answer({ kind: "notFound" }), 2)]);
    expect(host.innerHTML).toBe("");
  });
  it("one notFound hides only that section; the others stay", async () => {
    const host = await panel([section("a", answer({ kind: "notFound" })), section("b", answer({ kind: "empty" }), 2)]);
    expect(host.textContent).not.toContain("Odjeljak a");
    expect(host.textContent).toContain("Odjeljak b");
  });
  it("inMentorship=false never reads and shows nothing", async () => {
    const read = vi.fn<ThesisSectionDef<string>["read"]>().mockResolvedValue({ kind: "empty" });
    const host = await panel([section("a", read)], { inMentorship: false });
    expect(host.innerHTML).toBe("");
    expect(read).not.toHaveBeenCalled();
  });
  it("sections follow their order, not the array order", async () => {
    const host = await panel([section("a", answer({ kind: "empty" }), 2), section("z", answer({ kind: "empty" }), 1)]);
    const titles = [...host.querySelectorAll("h3")].map((n) => n.textContent);
    expect(titles).toEqual(["Odjeljak z", "Odjeljak a"]);
  });
});
