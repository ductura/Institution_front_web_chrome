// DAN-872: the settings screen's reads and saves through createApi() over the
// fake server of @ductura/test-fakes. Only keys of the catalogue are saved:
// a key outside it, or input outside the contract, is client_rejected and no
// request reaches the transport.
import type { AddressInfo } from "node:net";
import { createFakeServer, FAKE_VECTOR_HEADER, VECTORS, type FakeVector } from "@ductura/test-fakes/fake-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  applyLocale, applySetting, readAccountSettings, saveInterfaceLocale, saveSetting, type CatalogueKey, type SettingsCall,
} from "../components/settings/settings-model";
import { createApi } from "./api";

const server = createFakeServer();
let baseUrl = "";
beforeAll(async () => {
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((done) => server.close(() => done())));

const vector = (route: string, name: string) => {
  const found = VECTORS.find((v) => v.route === route && v.name === name);
  if (found === undefined) throw new Error(`no vector ${route} ${name}`);
  return found;
};

/** createApi over the fake server; each route answers with its named vector. Counts requests. */
function callFor(pick: Readonly<Record<string, FakeVector>>, sent: { count: number }): SettingsCall {
  return createApi({
    baseUrl,
    fetchImpl: (input, init) => {
      sent.count += 1;
      const path = new URL(String(input)).pathname;
      const chosen = Object.values(pick).find((v) => path.endsWith(v.route.split(".").slice(0, -1).join("/")));
      if (chosen === undefined) throw new Error(`unexpected request ${path}`);
      const headers = new Headers(init?.headers);
      for (const [name, value] of Object.entries(chosen.request.headers ?? {})) headers.set(name, value);
      headers.set(FAKE_VECTOR_HEADER, chosen.name);
      return fetch(input, { ...init, headers });
    },
  });
}

const READ = {
  catalogue: vector("settings.catalogue.get", "catalogue"),
  values: vector("settings.values.get", "personal"),
  locale: vector("profile.interface-locale.get", "saved"),
};
const CATALOGUE = (READ.catalogue.response.body as { keys: CatalogueKey[] }).keys;

describe("readAccountSettings over the fake server (DAN-872)", () => {
  it("reads the catalogue's personal keys with the caller's values and the saved locale, one request each", async () => {
    const sent = { count: 0 };
    const read = await readAccountSettings(callFor(READ, sent));
    expect(sent.count).toBe(3);
    expect(read).toEqual({
      kind: "ready",
      catalogue: CATALOGUE,
      settings: [
        { ...CATALOGUE.find((k) => k.key === "notifications.email"), value: false },
        { ...CATALOGUE.find((k) => k.key === "display.reduced_motion"), value: false },
      ],
      locale: "hr",
    });
  });

  it.each([
    ["settings.catalogue.get", "signed-out", "signedOut"],
    ["settings.values.get", "unavailable", "unavailable"],
    ["profile.interface-locale.get", "unauthorized", "signedOut"],
  ])("%s %s reads %s", async (route, name, kind) => {
    const key = route === "settings.catalogue.get" ? "catalogue" : route === "settings.values.get" ? "values" : "locale";
    expect(await readAccountSettings(callFor({ ...READ, [key]: vector(route, name) }, { count: 0 }))).toEqual({ kind });
  });
});

describe("saveSetting over the fake server: only keys of the catalogue (DAN-872)", () => {
  it("a key of the catalogue is saved as the vector answers", async () => {
    const sent = { count: 0 };
    const saved = vector("settings.values.put", "saved");
    expect(await saveSetting(callFor({ saved }, sent), CATALOGUE, "notifications.email", false)).toMatchObject({
      ok: true, status: 200, body: saved.response.body,
    });
    expect(sent.count).toBe(1);
  });

  it("the server's own unknown-key vector is never reached: client_rejected, no request", async () => {
    const sent = { count: 0 };
    const unknown = vector("settings.values.put", "unknown-key");
    const { key, value } = unknown.request.body as { key: string; value: unknown };
    expect(CATALOGUE.some((k) => k.key === key)).toBe(false);
    expect(await saveSetting(callFor({ unknown }, sent), CATALOGUE, key, value)).toEqual({ ok: false, status: 0, code: "client_rejected" });
    expect(sent.count).toBe(0);
  });

  it.each([
    ["a key of another level", "network.session_idle_minutes", 60],
    ["a value out of the key's kind", "notifications.email", "da"],
    ["a key in another case", "Notifications.Email", true],
  ])("%s is client_rejected, no request", async (_, key, value) => {
    const sent = { count: 0 };
    expect(await saveSetting(callFor({}, sent), CATALOGUE, key, value)).toEqual({ ok: false, status: 0, code: "client_rejected" });
    expect(sent.count).toBe(0);
  });
});

describe("saveInterfaceLocale over the fake server (DAN-872)", () => {
  it("en is saved as the vector answers", async () => {
    const sent = { count: 0 };
    const saved = vector("profile.interface-locale.post", "saved");
    expect(await saveInterfaceLocale(callFor({ saved }, sent), ["hr", "en"], "en")).toMatchObject({ ok: true, status: 200, body: { locale: "en" } });
    expect(sent.count).toBe(1);
  });

  it("the invalid-input vector's locale is client_rejected, no request", async () => {
    const sent = { count: 0 };
    const { locale } = vector("profile.interface-locale.post", "invalid-input").request.body as { locale: string };
    expect(await saveInterfaceLocale(callFor({}, sent), ["hr", "en"], locale)).toEqual({ ok: false, status: 0, code: "client_rejected" });
    expect(sent.count).toBe(0);
  });

  it("createApi refuses the same input on its own, also without the screen's check", async () => {
    const sent = { count: 0 };
    const api = callFor({}, sent) as unknown as (id: string, input: unknown) => Promise<unknown>;
    expect(await api("profile.interface-locale.post", { params: undefined, query: undefined, body: { locale: "de" } }))
      .toEqual({ ok: false, status: 0, code: "client_rejected" });
    expect(sent.count).toBe(0);
  });
});

describe("the screen's changes over the fake server (DAN-872)", () => {
  it("applySetting saves a catalogue key once and shows the vector's value; a foreign key sends nothing", async () => {
    const read = await readAccountSettings(callFor(READ, { count: 0 }));
    if (read.kind !== "ready") throw new Error("not ready");
    const sent = { count: 0 };
    const call = callFor({ saved: vector("settings.values.put", "saved") }, sent);
    const next = await applySetting(call, read, "notifications.email", false);
    expect(next.notice).toBe("changed");
    expect(sent.count).toBe(1);
    expect(await applySetting(call, read, "notifications.sms", false)).toEqual({ read, notice: "rejected" });
    expect(sent.count).toBe(1);
  });

  it("applyLocale saves en and the screen takes it", async () => {
    const read = await readAccountSettings(callFor(READ, { count: 0 }));
    if (read.kind !== "ready") throw new Error("not ready");
    const next = await applyLocale(callFor({ saved: vector("profile.interface-locale.post", "saved") }, { count: 0 }), ["hr", "en"], read, "en");
    expect(next).toEqual({ read: { ...read, locale: "en" }, notice: "changed" });
  });
});
