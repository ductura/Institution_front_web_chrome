import { describe, expect, it, vi } from "vitest";

import { createApi } from "../../../../../../src/client/api.ts";
import { clientTimeMachinePort, compareBlock } from "./client-port";
import { versionText } from "./model";

const baseUrl = "https://ductura.example.invalid";
const document = JSON.stringify({ schemaVersion: 2, nodes: [
  { type: "heading", level: 2, children: [{ type: "text", text: "Uvod" }] },
  { type: "paragraph", children: [{ type: "text", text: "Izmišljena rečenica " }, { type: "citation", sourceId: "s1" }, { type: "text", text: "o kompostu." }] },
] });

function serving(routes: Record<string, unknown>) {
  return vi.fn<typeof fetch>(async (url) => {
    const path = new URL(String(url)).pathname;
    const body = routes[path];
    return body === undefined ? Response.json({ code: "not_found" }, { status: 404 }) : Response.json(body);
  });
}

describe("time machine real port (PIL-D7-POVIJEST)", () => {
  it("lists the student's versions and reads the chosen one's text through the generated client", async () => {
    const fetchImpl = serving({
      "/api/v1/works/rad-1/versions": { versions: [
        { kind: "checkpoint", revision: 1, savedMinute: "2026-11-18T08:30:00.000Z" },
        { kind: "submission", revision: 2, savedMinute: "2026-11-19T10:00:00.000Z", afterDeadline: false },
      ], nextBeforeRevision: null },
      "/api/v1/works/rad-1/versions/2": { revision: 2, document },
    });
    const port = clientTimeMachinePort(createApi({ baseUrl, fetchImpl }));
    const list = await port.versions("rad-1");
    expect(list).toMatchObject({ kind: "ready", versions: [{ revision: 1 }, { revision: 2 }] });
    expect(list).not.toHaveProperty("more");
    const one = await port.version("rad-1", 2);
    if (one.kind !== "ready") throw new Error("ready expected");
    expect(versionText(one.document)).toEqual({ kind: "ready", blocks: [
      { kind: "heading", text: "Uvod", level: 2 }, { kind: "paragraph", text: "Izmišljena rečenica [navod]o kompostu." },
    ] });
    for (const [, init] of fetchImpl.mock.calls) expect(init?.method).toBe("GET");
  });

  it("gives an empty list for a work with no saved version and notFound for an unknown one", async () => {
    const port = clientTimeMachinePort(createApi({ baseUrl, fetchImpl: serving({ "/api/v1/works/prazan/versions": { versions: [], nextBeforeRevision: null } }) }));
    await expect(port.versions("prazan")).resolves.toEqual({ kind: "ready", versions: [] });
    await expect(port.version("prazan", 1)).resolves.toEqual({ kind: "notFound" });
  });

  it("maps the server's comparison to word blocks and passes failures through", async () => {
    expect(compareBlock({ kind: "paragraph", change: "removed", text: "stara  rečenica" })).toEqual({
      op: "removed", words: [{ op: "removed", text: "stara" }, { op: "removed", text: "rečenica" }],
    });
    expect(compareBlock({ kind: "heading", level: 2, change: "unchanged", text: "Uvod" }).op).toBe("same");
    const port = clientTimeMachinePort(createApi({ baseUrl, fetchImpl: serving({}) }));
    await expect(port.compare("rad-1", 1, 2)).resolves.toEqual({ kind: "notFound" });
  });

  it("never shows part of a document it cannot read", () => {
    expect(versionText("nije json")).toEqual({ kind: "unreadable" });
    expect(versionText(JSON.stringify({ nodes: [1] }))).toEqual({ kind: "unreadable" });
    expect(versionText(JSON.stringify({ schemaVersion: 2 }))).toEqual({ kind: "unreadable" });
    expect(versionText(JSON.stringify({ nodes: [] }))).toEqual({ kind: "ready", blocks: [] });
  });

  it("says that older versions exist when the server names the next page", async () => {
    const fetchImpl = serving({
      "/api/v1/works/rad-1/versions": { versions: [{ kind: "checkpoint", revision: 5, savedMinute: "2026-11-18T08:30:00.000Z" }], nextBeforeRevision: 5 },
    });
    const list = await clientTimeMachinePort(createApi({ baseUrl, fetchImpl })).versions("rad-1");
    expect(list).toMatchObject({ kind: "ready", more: true });
  });
});
