import { expect, it } from "vitest";

import { hasExitCopies, keepExitCopy, readExitCopies } from "./recovery";

function storage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    key: (i) => Array.from(data.keys())[i] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
    clear: () => data.clear(),
  };
}

it("only offers copies to the matching journal scope and keeps successive text backups", () => {
  const store = storage();
  expect(hasExitCopies(store)).toBe(false);
  const assignmentId = "izmisljeni-rad";
  const first = { assignmentId, at: 10, text: "Prva izmišljena verzija" };
  const second = { assignmentId, at: 20, text: "Druga izmišljena verzija" };
  expect(keepExitCopy(store, "demo-student-a", first)).toBe(true);
  expect(keepExitCopy(store, "demo-student-a", second)).toBe(true);
  expect(hasExitCopies(store)).toBe(true);
  expect(readExitCopies(store, "demo-student")).toEqual([]);
  expect(readExitCopies(store, "demo-student-b")).toEqual([]);
  expect(readExitCopies(store, "demo-student-a").map(({ copy }) => copy)).toEqual([second, first]);
});

it("an existing journal needs only a recovery link and repeat sign-outs refresh it", () => {
  const store = storage();
  const copy = { assignmentId: "izmisljeni-rad", at: 10, text: null };
  keepExitCopy(store, "demo-student-a", copy);
  keepExitCopy(store, "demo-student-a", { ...copy, at: 20 });
  expect(readExitCopies(store, "demo-student-a").map(({ copy }) => copy)).toEqual([{ ...copy, at: 20 }]);
});

it("reports unavailable or full storage and ignores damaged copies", () => {
  const copy = { assignmentId: "izmisljeni-rad", at: 10, text: "Izmišljeni tekst" };
  const store = storage();
  store.setItem("ductura:editor-exit:demo-student-a:bad", "{");
  store.setItem("ductura:editor-exit:demo-student-a:invalid", '{"assignmentId":"izmisljeni-rad","at":1e20,"text":null}');
  expect(readExitCopies(store, "demo-student-a")).toEqual([]);
  expect(keepExitCopy(null, "demo-student-a", copy)).toBe(false);
  store.setItem = () => { throw new DOMException("Full", "QuotaExceededError"); };
  expect(keepExitCopy(store, "demo-student-a", copy)).toBe(false);
});
