import { describe, expect, it, vi } from "vitest";

import { findForbiddenTerms } from "../../../../scripts/forbidden-terms/terms";
import { moveItem, triggerAt, triggerItems, type Source } from "./items";
import { editorTriggersHr } from "./messages.hr";

describe("editor triggers", () => {
  it("finds only a standalone trigger immediately before the caret", () => {
    expect(triggerAt("A (@Ča", 12)).toEqual({ mode: "at", query: "Ča", from: 9, to: 12 });
    expect(triggerAt("/", 1)).toEqual({ mode: "slash", query: "", from: 0, to: 1 });
    expect(triggerAt("\uFFFC/po", 4)?.from).toBe(1);
    for (const text of ["ime@domena", "https://domena/put", "@a-b", "@petnaestznakova", "@upit "]) {
      expect(triggerAt(text, text.length), text).toBeNull();
    }
  });

  it("filters sources by word prefix, keeps page notes and passes the author's query through", () => {
    const cite = vi.fn();
    const addSource = vi.fn();
    const source: Source = { id: "demo", label: "Čavlović (2026)", title: "Izmišljeni izvor", search: "Ana Čavlović",
      notes: [{ id: "bilješka", page: "14", text: "Izmišljena bilješka" }] };
    const items = triggerItems({ mode: "at", query: "ča", from: 0, to: 3 }, [source], { cite, addSource }, vi.fn());
    expect(items.map(({ label }) => label)).toEqual(["Čavlović (2026)", "Čavlović (2026), str. 14", "Dodaj novi izvor…"]);
    items[1]?.run?.();
    items[2]?.run?.();
    expect(cite).toHaveBeenCalledWith("demo", "14");
    expect(addSource).toHaveBeenCalledWith("Ča");
  });

  it("keeps unavailable commands visible and cycles through usable entries only", () => {
    const items = triggerItems({ mode: "slash", query: "", from: 0, to: 1 }, [], {}, vi.fn());
    expect(items[0]).toMatchObject({ label: "/navod", disabled: true });
    expect(items.find(({ id }) => id === "tablica")?.disabled).toBe(true);
    expect(moveItem(items, -1, 1)).toBe(1);
    expect(items[moveItem(items, 1, -1)]?.id).toBe("popis");
    expect(moveItem([{ id: "demo", label: "", hint: "", disabled: true }], -1, 1)).toBe(-1);
    expect(findForbiddenTerms(JSON.stringify(editorTriggersHr), "hr")).toEqual([]);
  });
});
