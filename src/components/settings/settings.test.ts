// DAN-872: only keys of the catalogue are saved. Anything else is
// client_rejected and no call is made; src/client/settings.test.ts runs the
// same functions through createApi() over the fake server.
import fc from "fast-check";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../scripts/forbidden-terms/terms.ts";
import { INTERFACE_LOCALES } from "../i18n/locale.ts";
import { SETTINGS_EN, SETTINGS_HR } from "../i18n/settings.ts";

import Settings from "./Settings";
import { readSettings, saveInterfaceLocale, saveSetting, type CatalogueKey, type SettingsCall, type SettingsRead } from "./settings-model";

const CATALOGUE: CatalogueKey[] = [
  { key: "notifications.email", levels: ["personal"], kind: "boolean", default: true },
  { key: "display.reduced_motion", levels: ["personal"], kind: "boolean", default: false },
  { key: "display.page_size", levels: ["personal"], kind: "integer", default: 20, min: 10, max: 50 },
  { key: "display.density", levels: ["personal"], kind: "enum", default: "normal", values: ["normal", "compact"] },
  { key: "network.session_idle_minutes", levels: ["network_security"], kind: "integer", default: 120, min: 15, max: 120 },
];

/** A call that answers from a table and counts what it was asked. */
function counting(answers: Partial<Record<string, unknown>> = {}) {
  const sent: { id: string; input: unknown }[] = [];
  const call = (async (id: string, input: unknown) => {
    sent.push({ id, input });
    const answer = answers[id];
    if (answer instanceof Error) throw answer;
    return answer ?? { ok: true, status: 200, body: { key: "x", value: null, changed: true } };
  }) as unknown as SettingsCall;
  return { call, sent };
}
const REJECTED = { ok: false, status: 0, code: "client_rejected" };

describe("saveSetting: only keys of the catalogue (DAN-872)", () => {
  it.each([
    ["a key outside the catalogue", "notifications.sms", false],
    ["a key of another level", "network.session_idle_minutes", 60],
    ["a value of another kind", "notifications.email", "false"],
    ["a number for a boolean", "notifications.email", 0],
    ["an integer below min", "display.page_size", 9],
    ["an integer above max", "display.page_size", 51],
    ["a fraction", "display.page_size", 20.5],
    ["an unsafe integer", "display.page_size", 2 ** 53],
    ["a value outside the enum", "display.density", "wide"],
    ["a prototype member as key", "__proto__", true],
    ["a key that is no string", { key: "notifications.email" }, true],
    ["a value that is an object", "notifications.email", { valueOf: () => true }],
  ])("%s is client_rejected with no call", async (_, key, value) => {
    const { call, sent } = counting();
    expect(await saveSetting(call, CATALOGUE, key, value)).toEqual(REJECTED);
    expect(sent).toEqual([]);
  });

  it("any key that is not in the catalogue is client_rejected with no call (property)", async () => {
    const known = new Set(CATALOGUE.map((entry) => entry.key));
    await fc.assert(fc.asyncProperty(fc.anything().filter((key) => !known.has(key as string)), fc.anything(), async (key, value) => {
      const { call, sent } = counting();
      expect(await saveSetting(call, CATALOGUE, key, value)).toEqual(REJECTED);
      expect(sent).toEqual([]);
    }));
  });

  it.each([
    ["notifications.email", false],
    ["display.page_size", 50],
    ["display.density", "compact"],
    ["notifications.email", null],
  ])("%s = %j is sent once, at the personal level with no bound", async (key, value) => {
    const { call, sent } = counting();
    await saveSetting(call, CATALOGUE, key, value);
    expect(sent).toEqual([{
      id: "settings.values.put",
      input: { params: undefined, query: undefined, body: { level: "personal", course: null, key, value, locked: false, min: null, max: null } },
    }]);
  });

  it("a broken connection reads unavailable", async () => {
    const { call } = counting({ "settings.values.put": new TypeError("Failed to fetch") });
    expect(await saveSetting(call, CATALOGUE, "notifications.email", false)).toEqual({ ok: false, status: 0, code: "unavailable" });
  });
});

describe("saveInterfaceLocale (DAN-872)", () => {
  it.each(["de", "HR", "hr-HR", " en", "", null, undefined, 1, ["en"], new String("en")])("%j is client_rejected with no call", async (value) => {
    const { call, sent } = counting();
    expect(await saveInterfaceLocale(call, INTERFACE_LOCALES, value)).toEqual(REJECTED);
    expect(sent).toEqual([]);
  });

  it("a locale without a registered catalogue is client_rejected", async () => {
    const { call, sent } = counting();
    expect(await saveInterfaceLocale(call, ["hr"], "en")).toEqual(REJECTED);
    expect(sent).toEqual([]);
  });

  it.each(INTERFACE_LOCALES)("%s is sent once, exactly", async (locale) => {
    const { call, sent } = counting();
    await saveInterfaceLocale(call, INTERFACE_LOCALES, locale);
    expect(sent).toEqual([{ id: "profile.interface-locale.post", input: { params: undefined, query: undefined, body: { locale } } }]);
  });
});

describe("readSettings (DAN-872)", () => {
  const ok = (body: unknown) => ({ ok: true, status: 200, body });
  const answers = {
    "settings.catalogue.get": ok({ keys: CATALOGUE }),
    "settings.values.get": ok({
      level: "personal", course: null,
      values: [{ key: "notifications.email", value: false, bound: null, updatedAt: "2026-11-16T08:15:00.000Z" }],
      inherited: [{ key: "display.page_size", value: 30, source: "institution", bound: null }],
    }),
    "profile.interface-locale.get": ok({ locale: "en" }),
  };

  it("gives the personal keys with the own value, else the inherited one, else the default", async () => {
    const read = await readSettings(counting(answers).call);
    expect(read.kind === "ready" && read.settings.map((s) => [s.key, s.value])).toEqual([
      ["notifications.email", false], ["display.reduced_motion", false], ["display.page_size", 30], ["display.density", "normal"],
    ]);
    expect(read.kind === "ready" && read.locale).toBe("en");
  });

  it("a stored value the catalogue does not allow falls back, never shown as held", async () => {
    const values = ok({ level: "personal", course: null, values: [{ key: "display.density", value: "gone", bound: null, updatedAt: "2026-11-16T08:15:00.000Z" }], inherited: [] });
    const read = await readSettings(counting({ ...answers, "settings.values.get": values }).call);
    expect(read.kind === "ready" && read.settings.find((s) => s.key === "display.density")?.value).toBe("normal");
  });

  it.each([
    [{ "settings.values.get": { ok: false, status: 401, code: "unauthorized" } }, "signedOut"],
    [{ "profile.interface-locale.get": { ok: false, status: 503, code: "unavailable" } }, "unavailable"],
    [{ "settings.catalogue.get": new TypeError("Failed to fetch") }, "unavailable"],
  ])("a failure reads %j, never defaults", async (over, kind) => {
    expect(await readSettings(counting({ ...answers, ...over }).call)).toEqual({ kind });
  });
});

describe("Settings screen (DAN-872)", () => {
  const ready: SettingsRead = {
    kind: "ready", catalogue: CATALOGUE, locale: null,
    settings: [{ ...CATALOGUE[0]!, value: false }, { ...CATALOGUE[2]!, value: 20 }],
  };
  const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  it("draws only keys with a label, and the default language checked", () => {
    const html = renderToStaticMarkup(h(Settings, { read: ready }));
    expect(text(html)).toContain(SETTINGS_HR.keys["notifications.email"]);
    expect(html).not.toContain("display.page_size");
    expect(html).toMatch(/checked="" value="hr"/);
    expect(html).not.toMatch(/checked="" value="en"/);
  });

  it("draws in the saved language when the page passes none", () => {
    const html = renderToStaticMarkup(h(Settings, { read: { ...ready, locale: "en" } }));
    expect(text(html)).toContain(SETTINGS_EN.heading);
    expect(html).toMatch(/checked="" value="en"/);
  });

  it("draws in English when the locale is en", () => {
    const html = renderToStaticMarkup(h(Settings, { read: ready, locale: "en", notice: "rejected" }));
    expect(text(html)).toContain(SETTINGS_EN.heading);
    expect(text(html)).toContain(SETTINGS_EN.notice.rejected);
  });

  it("disables every control while busy", () => {
    const html = renderToStaticMarkup(h(Settings, { read: ready, busy: true }));
    expect(html).toMatch(/<fieldset[^>]*disabled=""/);
    expect(html).toMatch(/type="checkbox"[^>]*disabled=""|disabled=""[^>]*type="checkbox"/);
  });

  it("has no forbidden term in either language (PRODUCT §5)", () => {
    const all = (o: unknown): string[] => (typeof o === "string" ? [o] : Object.values(o as object).flatMap(all));
    for (const [lang, table] of [["hr", SETTINGS_HR], ["en", SETTINGS_EN]] as const) {
      for (const line of all(table)) expect(findForbiddenTerms(line, lang), line).toEqual([]);
    }
  });
});
