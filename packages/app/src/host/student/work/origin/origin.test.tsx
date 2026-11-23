import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PAGES, resolve } from "../../../../routes";
import { originText } from "../../../teacher/provenance/origin-messages.hr";
import { shareRows } from "../../../teacher/provenance/origin-model";
import { OriginView } from "./OriginView";
import { readOfParts } from "./model";
import { originReader } from "./read";

// Invented work; no real person or text.
const ORIGIN = "https://ductura.example.invalid";
const DOCUMENT = "izmisljeni-rad-1";
const PARTS = [
  { kind: "typed", percent: 62 }, { kind: "assistant_inserted", percent: 10 }, { kind: "assistant_match", percent: 4 },
  { kind: "imported_file", percent: 12 }, { kind: "pasted_known", percent: 9 }, { kind: "pasted_unknown", percent: 3 },
];
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
function reader(response: Response | Error) {
  const transport = vi.fn<typeof fetch>();
  if (response instanceof Error) transport.mockRejectedValue(response);
  else transport.mockResolvedValue(response);
  return { transport, read: originReader({ baseUrl: ORIGIN, fetchImpl: transport }) };
}
const html = (read: Parameters<typeof OriginView>[0]["read"]) => renderToStaticMarkup(createElement(OriginView, { read, onRetry: () => {} }));

describe("PIL-P1-SASTAV-STUDENT Podrijetlo teksta", () => {
  it("shows the same rows for the same answer as the teacher's composition model", () => {
    const read = readOfParts(PARTS);
    if (read.kind !== "ready") throw new Error("expected ready");
    const rows = shareRows(read.composition).map((r) => r.label);
    expect(rows).toEqual([
      "Tipkano u Ducturi · 62 %", "Umetnuto iz pomoćnika · 10 %", "Podudara se s odgovorom pomoćnika · 4 %",
      "Uvezeno iz datoteke · 12 %", "Zalijepljeno, podrijetlo poznato · 9 %", "Zalijepljeno, podrijetlo nepoznato · 3 %",
    ]);
    const out = html(read);
    for (const row of rows) expect(out).toContain(row.replace(/&/g, "&amp;"));
  });

  it("carries both captions", () => {
    const out = html(readOfParts(PARTS));
    expect(out).toContain("Nepoznato podrijetlo nije prekršaj");
    expect(out).toContain("Ductura ne otkriva alate izvan sebe");
    expect(out).toContain(originText.unknownNotice);
  });

  it("shows no unknown-origin notice when there is none, and keeps the limits caption", () => {
    const out = html(readOfParts(PARTS.map((p) => ({ ...p, percent: p.kind === "typed" ? 100 : 0 }))));
    expect(out).not.toContain("data-unknown-notice");
    expect(out).toContain("Ductura ne otkriva alate izvan sebe");
  });

  it("reads work.origin-composition.get for the one work and turns the answer into the view", async () => {
    const { transport, read } = reader(ok({ parts: PARTS }));
    const answer = await read(DOCUMENT);
    expect(answer.kind).toBe("ready");
    expect(String(transport.mock.calls[0]?.[0])).toContain(`/works/${DOCUMENT}/origin-composition`);
  });

  it("maps 401, 404, an unusable answer and a failure to their states, and no text to empty", async () => {
    expect((await reader(new Response("{}", { status: 401 })).read(DOCUMENT)).kind).toBe("signedOut");
    expect((await reader(new Response("{}", { status: 404 })).read(DOCUMENT)).kind).toBe("notFound");
    expect((await reader(ok({ parts: [{ kind: "typed", percent: 1 }] })).read(DOCUMENT)).kind).toBe("unavailable");
    expect((await reader(new Error("offline")).read(DOCUMENT)).kind).toBe("unavailable");
    expect((await reader(new Response("{}", { status: 503 })).read(DOCUMENT)).kind).toBe("unavailable");
    expect(readOfParts(PARTS.map((p) => ({ ...p, percent: 0 }))).kind).toBe("empty");
    expect((await reader(ok({ parts: [] })).read("")).kind).toBe("notFound");
  });

  it("shows a state line, never a composition, while loading or when unavailable", () => {
    expect(html(null)).toContain(originText.loading);
    const out = html({ kind: "unavailable" });
    expect(out).toContain(originText.unavailable);
    expect(out).not.toContain("data-kind");
  });

  it("is a page of the student only", () => {
    expect(PAGES.some((p) => p.path === "/rad/[assignmentId]/podrijetlo" && p.roles.length === 1 && p.roles[0] === "student")).toBe(true);
    expect(resolve("/rad/abc/podrijetlo", "student")).toMatchObject({ kind: "page", page: { path: "/rad/[assignmentId]/podrijetlo" } });
    expect(resolve("/rad/abc/podrijetlo", "teacher")).toEqual({ kind: "redirect", to: "/nastavnik" });
  });
});
