import { describe, expect, it } from "vitest";
import { parseTemplate, templateBlocks, type TitleField } from "./template";
import { readTemplate } from "./template-port";

// Invented data only.
const labels: Record<TitleField, string> = { title: "Naslov", author: "Autor", mentor: "Mentor", course: "Kolegij", date: "Datum" };
const body = { version: 2, titlePage: ["title", "author"], sections: [{ title: "Uvod", hint: "Predstavite temu." }, { title: "Zaključak", hint: "" }], citationStyle: "fpzg" };

describe("parseTemplate", () => {
  it("accepts the contract's shape", () => expect(parseTemplate(body)?.version).toBe(2));
  it.each([
    ["wrong style", { ...body, citationStyle: "apa" }],
    ["unknown title field", { ...body, titlePage: ["title", "oib"] }],
    ["empty section title", { ...body, sections: [{ title: " ", hint: "" }] }],
    ["version 0", { ...body, version: 0 }],
    ["too many sections", { ...body, sections: Array.from({ length: 31 }, () => ({ title: "x", hint: "" })) }],
    ["not an object", null],
  ])("refuses %s", (_n, v) => expect(parseTemplate(v)).toBeNull());
});

describe("templateBlocks", () => {
  it("makes title lines, then a heading and a hint paragraph per section", () => {
    const blocks = templateBlocks(parseTemplate(body)!, labels);
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "paragraph", "heading", "paragraph", "heading", "paragraph"]);
    expect(blocks[0]?.content?.[0]?.text).toBe("Naslov: ");
    expect(blocks[3]?.content?.[0]?.text).toBe("Predstavite temu.");
    expect(blocks[5]?.content).toBeUndefined();
  });
});

describe("readTemplate", () => {
  it("ready on 200", async () => expect((await readTemplate("a", (async () => ({ ok: true, status: 200, body })) as never)).kind).toBe("ready"));
  it("none on 404, the same for foreign and unknown", async () => expect(await readTemplate("a", (async () => ({ ok: false, status: 404 })) as never)).toEqual({ kind: "none" }));
  it("signedOut on 401, not unavailable", async () => expect(await readTemplate("a", (async () => ({ ok: false, status: 401 })) as never)).toEqual({ kind: "signedOut" }));
  it("unavailable, not none, on a server error, a throw or a wrong shape", async () => {
    expect((await readTemplate("a", (async () => ({ ok: false, status: 503 })) as never)).kind).toBe("unavailable");
    expect((await readTemplate("a", (async () => { throw new Error("x"); }) as never)).kind).toBe("unavailable");
    expect((await readTemplate("a", (async () => ({ ok: true, status: 200, body: {} })) as never)).kind).toBe("unavailable");
  });
});
