import { expect, it } from "vitest";
import { readStates, stateCounts, toggleState, writeStates } from "./source-state";

const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

it("toggles and counts", () => {
  let s = toggleState({}, "a", "get");
  s = toggleState(s, "b", "have");
  expect(stateCounts(["a", "b", "c"], s)).toEqual({ get: 1, unread: 2, any: true });
  expect(toggleState(s, "a", "get")).toEqual({ b: "have" });
  expect(toggleState(s, "a", "read")).toEqual({ b: "have", a: "read" });
});

it("keeps the state per work and survives a broken store", () => {
  const store = memory();
  writeStates("d1", { a: "read" }, store);
  expect(readStates("d1", store)).toEqual({ a: "read" });
  expect(readStates("d2", store)).toEqual({});
  store.setItem("ductura.editor.source-state:d3", "{x");
  expect(readStates("d3", store)).toEqual({});
  store.setItem("ductura.editor.source-state:d4", JSON.stringify({ a: "bogus", b: "get" }));
  expect(readStates("d4", store)).toEqual({ b: "get" });
  expect(readStates("d1", null)).toEqual({});
});
