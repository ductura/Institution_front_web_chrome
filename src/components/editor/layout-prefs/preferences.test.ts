import { afterEach, expect, it, vi } from "vitest";

import {
  DEFAULT_PREFERENCES, effectiveLayout, LEFT_PARTS, listsStartWholeWork, partOrder, PREFERENCES_KEY, readPreferences, rowShows,
  withPartMoved, withPartShown, withRowPart, withScope, withSubs, writePreferences,
  groupOrder, RIGHT_GROUPS, visibleGroups, withGroupMoved, withGroupShown,
} from "./preferences";

afterEach(() => vi.unstubAllGlobals());

it("round-trips independent desktop and mobile choices", () => {
  const values = new Map<string, string>();
  vi.stubGlobal("window", { localStorage: { getItem: values.get.bind(values), setItem: values.set.bind(values) } });
  const prefs = { left: { layout: "b", mobile: "same" }, right: { layout: "c", mobile: "b" } } as const;
  writePreferences(prefs);
  expect(readPreferences()).toEqual(prefs);
  expect(effectiveLayout(prefs.left, true)).toBe("b");
  expect(effectiveLayout(prefs.right, false)).toBe("c");
  expect(effectiveLayout(prefs.right, true)).toBe("b");
  expect(effectiveLayout(DEFAULT_PREFERENCES.left, true)).toBe("c");
});

it("ignores invalid values without losing valid settings from the same record", () => {
  const getItem = vi.fn().mockReturnValueOnce("{").mockReturnValueOnce('{"left":{"layout":"z","mobile":"b"},"right":null}');
  vi.stubGlobal("window", { localStorage: { getItem } });
  expect(readPreferences()).toEqual(DEFAULT_PREFERENCES);
  expect(readPreferences()).toEqual({ ...DEFAULT_PREFERENCES, left: { layout: "a", mobile: "b" } });
  expect(getItem).toHaveBeenCalledWith(PREFERENCES_KEY);
});

// ED-39: "Gustoća: Zbijeno" is kept per side; anything but `true` reads as "Prozračno" (no key).
it("keeps a dense side and reads anything else as airy", () => {
  const values = new Map<string, string>();
  vi.stubGlobal("window", { localStorage: { getItem: values.get.bind(values), setItem: values.set.bind(values) } });
  writePreferences({ left: { layout: "a", mobile: "c", dense: true }, right: { layout: "a", mobile: "same" } });
  expect(readPreferences()).toEqual({ left: { layout: "a", mobile: "c", dense: true }, right: { layout: "a", mobile: "same" } });
  values.set(PREFERENCES_KEY, '{"left":{"layout":"b","mobile":"c","dense":"yes"},"right":{"layout":"a","mobile":"same","dense":false}}');
  expect(readPreferences()).toEqual({ left: { layout: "b", mobile: "c" }, right: { layout: "a", mobile: "same" } });
});

it("uses the defaults when the browser disallows access to storage", () => {
  vi.stubGlobal("window", { get localStorage() { throw new Error("denied"); } });
  expect(readPreferences()).toEqual(DEFAULT_PREFERENCES);
  expect(() => writePreferences(DEFAULT_PREFERENCES)).not.toThrow();
});

// ED-37 (P2-6) "U retku poglavlja": the row shows all by default; switched-off parts are kept in a fixed
// order, unknown ones dropped, and switching every part back on leaves no key.
it("keeps the chapter row parts switched off and nothing when all are on", () => {
  const values = new Map<string, string>();
  vi.stubGlobal("window", { localStorage: { getItem: values.get.bind(values), setItem: values.set.bind(values) } });
  expect(rowShows(DEFAULT_PREFERENCES.left)).toEqual({ words: true, status: true, flags: true });
  const off = withRowPart(withRowPart({ ...DEFAULT_PREFERENCES.left, dense: true }, "flags", false), "words", false);
  expect(off).toEqual({ layout: "a", mobile: "c", dense: true, hideRow: ["words", "flags"] });
  expect(rowShows(off)).toEqual({ words: false, status: true, flags: false });
  expect(withRowPart(withRowPart(off, "words", true), "flags", true)).toEqual({ layout: "a", mobile: "c", dense: true });
  values.set(PREFERENCES_KEY, '{"left":{"layout":"a","mobile":"c","hideRow":["status","bogus","status"]},"right":{"layout":"a","mobile":"same","hideRow":"words"}}');
  expect(readPreferences()).toEqual({ left: { layout: "a", mobile: "c", hideRow: ["status"] }, right: { layout: "a", mobile: "same" } });
});

// ED-70 "Donji dijelovi": the parts move one place at a time and stay in range; the default order and
// "all shown" leave no key, so a reset and an untouched panel read the same.
it("moves and hides the left parts and keeps no key for the defaults", () => {
  const start = DEFAULT_PREFERENCES.left;
  expect(partOrder(start)).toEqual([...LEFT_PARTS]);
  const moved = withPartMoved(start, "thread", -1);
  expect(moved.order).toEqual(["figures", "stash", "progress", "thread", "deadlines"]);
  expect(withPartMoved(moved, "thread", 1)).toEqual(start);
  expect(withPartMoved(start, "figures", -1)).toBe(start);
  expect(withPartMoved(start, "thread", 1)).toBe(start);
  const hidden = withPartShown(withPartShown(start, "thread", false), "stash", false);
  expect(hidden.hideParts).toEqual(["stash", "thread"]);
  expect(withPartShown(withPartShown(hidden, "stash", true), "thread", true)).toEqual(start);
});

// ED-116 "Popisi prvo pokazuju": "Ovo poglavlje" is the default (no key); only the right side keeps "Cijeli rad".
it("keeps the list scope on the right only and reads anything else as this chapter", () => {
  const values = new Map<string, string>();
  vi.stubGlobal("window", { localStorage: { getItem: values.get.bind(values), setItem: values.set.bind(values) } });
  expect(listsStartWholeWork()).toBe(false);
  const all = withScope(DEFAULT_PREFERENCES.right, "all");
  expect(all).toEqual({ layout: "a", mobile: "same", scope: "all" });
  expect(withScope(all, "chapter")).toEqual(DEFAULT_PREFERENCES.right);
  writePreferences({ left: DEFAULT_PREFERENCES.left, right: all });
  expect(readPreferences().right).toEqual(all);
  expect(listsStartWholeWork()).toBe(true);
  values.set(PREFERENCES_KEY, JSON.stringify({ left: { layout: "a", mobile: "c", scope: "all" }, right: { layout: "a", mobile: "same", scope: "chapter" } }));
  expect(readPreferences()).toEqual(DEFAULT_PREFERENCES);
  expect(listsStartWholeWork()).toBe(false);
});

// ED-118 "Dijelovi panela i redoslijed": right groups move and hide like the left parts; the last shown
// group stays, the defaults leave no key, and the left side keeps neither.
it("moves and hides the right groups, keeps one shown and stores nothing for the defaults", () => {
  const values = new Map<string, string>();
  vi.stubGlobal("window", { localStorage: { getItem: values.get.bind(values), setItem: values.set.bind(values) } });
  const start = DEFAULT_PREFERENCES.right;
  expect(groupOrder(start)).toEqual([...RIGHT_GROUPS]);
  const moved = withGroupMoved(start, "comments", -1);
  expect(moved.groups).toEqual(["comments", "sources", "review", "work", "assistant"]);
  expect(withGroupMoved(moved, "comments", 1)).toEqual(start);
  expect(withGroupMoved(start, "sources", -1)).toBe(start);
  let hidden = withGroupShown(moved, "work", false);
  expect(visibleGroups(hidden)).toEqual(["comments", "sources", "review", "assistant"]);
  for (const group of ["comments", "sources", "review"] as const) hidden = withGroupShown(hidden, group, false);
  expect(visibleGroups(hidden)).toEqual(["assistant"]);
  expect(withGroupShown(hidden, "assistant", false)).toBe(hidden);
  writePreferences({ left: DEFAULT_PREFERENCES.left, right: hidden });
  expect(readPreferences().right).toEqual(hidden);
  values.set(PREFERENCES_KEY, JSON.stringify({
    left: { layout: "a", mobile: "c", groups: ["work"], hideGroups: ["work"] },
    right: { layout: "a", mobile: "same", groups: ["bogus", "sources"], hideGroups: [...RIGHT_GROUPS] },
  }));
  expect(readPreferences()).toEqual(DEFAULT_PREFERENCES);
});

// ED-70 "Potpoglavlja": "Rasklopljena" is the default (no key); only the left side keeps the parts.
it("keeps the subchapter mode and reads only valid parts on the left", () => {
  const values = new Map<string, string>();
  vi.stubGlobal("window", { localStorage: { getItem: values.get.bind(values), setItem: values.set.bind(values) } });
  const closed = withSubs(DEFAULT_PREFERENCES.left, "closed");
  expect(closed).toEqual({ layout: "a", mobile: "c", subs: "closed" });
  expect(withSubs(closed, "open")).toEqual(DEFAULT_PREFERENCES.left);
  const left = { ...withPartMoved(withSubs(DEFAULT_PREFERENCES.left, "active"), "stash", -1), hideParts: ["progress" as const] };
  writePreferences({ left, right: DEFAULT_PREFERENCES.right });
  expect(readPreferences().left).toEqual(left);
  values.set(PREFERENCES_KEY, JSON.stringify({
    left: { layout: "a", mobile: "c", order: ["thread", "bogus", "thread", 4], hideParts: ["deadlines", "x"], subs: "half" },
    right: { layout: "a", mobile: "same", order: ["thread"], hideParts: ["stash"], subs: "closed" },
  }));
  expect(readPreferences()).toEqual({
    left: { layout: "a", mobile: "c", order: ["thread", "figures", "stash", "progress", "deadlines"], hideParts: ["deadlines"] },
    right: { layout: "a", mobile: "same" },
  });
});