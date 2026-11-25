import { afterEach, expect, it, vi } from "vitest";

import { DEFAULT_PREFERENCES, effectiveLayout, PREFERENCES_KEY, readPreferences, writePreferences } from "./preferences";

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
