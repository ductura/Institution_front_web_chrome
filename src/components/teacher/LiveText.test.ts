import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { readLiveState, type LiveView } from "@/client/live-reader";
import { validateVersionedDocument, type CanonicalDocument, type CanonicalDocumentV3, type NodeId } from "@/domain/document";
import { messagesHr } from "@/lib/i18n/messages.hr";

import { canonicalizeJcs } from "../../../packages/editor-core/src/document/forensics/jcs";

import { anchorForSelection, blockText, placeAnchor, type TextRange } from "./comment-place";
import LiveText, { atomLabel, liveStopped, openMarks } from "./LiveText";
import type { PlacedThread } from "./TeacherComments";

// #732 item 7: the teacher and the student draw the live text through this one
// component (PRODUCT §5 rule 5). Every text and id below is invented.
// SheetFrame is JSX, which this test environment does not parse; its own
// markup (the theme switch and the article) is the same for both sides.
vi.mock("@/components/shell/SheetFrame", async () => {
  const { createElement } = await import("react");
  return { default: ({ children }: { children: unknown }) => createElement("article", { className: "sheet" }, children as never) };
});

const P1 = "0f8e2a64-1b3c-4d5e-8f60-718293a4b5c6" as NodeId;
const H1 = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d" as NodeId;
const DOC: CanonicalDocument = {
  schemaVersion: 1,
  nodes: [
    { type: "heading", level: 1, id: H1, children: [{ type: "text", text: "Izmišljeni naslov", marks: [] }] },
    { type: "paragraph", id: P1, children: [{ type: "text", text: "Gradske knjižnice su mjesto susreta.", marks: ["italic"] }] },
  ],
} as CanonicalDocument;
const SHOWN: LiveView = { document: DOC, hash: "a".repeat(64), empty: false, connection: "live", submitted: false };
const MARK: TextRange = { nodeId: P1, start: 8, end: 17 };
const t = messagesHr.liveView;

const render = (props: Parameters<typeof LiveText>[0]) => renderToStaticMarkup(h(LiveText, props));
/** The `role="document"` region alone: the part both sides must share byte for byte. */
const region = (html: string) => html.match(/<div[^>]*role="document"[\s\S]*?<\/article>/)![0];

describe("LiveText", () => {
  it("draws the same markup with or without the teacher's selection handler and ref", () => {
    const teacher = render({ view: SHOWN, marks: [MARK], textRef: { current: null }, onSelect: () => {} });
    const student = render({ view: SHOWN, marks: [MARK] });
    expect(student).toBe(teacher);
    expect(student).toContain("<mark");
    expect(student).toContain(t.note);
  });

  it("draws consecutive bullet items as one list between the other blocks (E1)", () => {
    const B1 = "2b3c4d5e-6f70-4a8b-9cad-1e2f3a4b5c6d" as NodeId;
    const B2 = "3c4d5e6f-7081-4b9c-8dbe-2f3a4b5c6d7e" as NodeId;
    const item = (id: NodeId, text: string) => ({ type: "bulletItem", id, children: [{ type: "text", text, marks: [] }] });
    const document = { ...DOC, nodes: [DOC.nodes[0], item(B1, "Prva izmišljena stavka"), item(B2, "Druga izmišljena stavka"), DOC.nodes[1]] } as CanonicalDocument;
    const html = render({ view: { ...SHOWN, document }, marks: [] });
    expect(html).toContain(`<ul><li data-node-id="${B1}"><span>Prva izmišljena stavka</span></li><li data-node-id="${B2}">`);
    expect(html.match(/<ul>/g)).toHaveLength(1);
    expect(html.indexOf("<ul>")).toBeLessThan(html.indexOf(`<p data-node-id="${P1}">`));
  });

  it("draws a heading above the text region and leaves the region itself unchanged", () => {
    const heading = h("h1", { className: "manuscript manuscript__title" }, "Izmišljeni rad");
    const withHeading = render({ view: SHOWN, marks: [MARK], heading });
    const without = render({ view: SHOWN, marks: [MARK] });
    expect(region(withHeading)).toBe(region(without));
    expect(withHeading.indexOf("<h1")).toBeLessThan(withHeading.indexOf('role="document"'));
    expect(withHeading.indexOf("<h1")).toBeGreaterThan(withHeading.indexOf("<article"));
    // The work's own level 1 heading stays an h2 under the page's h1.
    expect(without).toContain(`<h2 data-node-id="${H1}">`);
  });

  it("draws consecutive bullet items as one list (E1) and keeps marks inside an item", () => {
    const B1 = "2b3c4d5e-6f70-4a8b-9c0d-1e2f3a4b5c6d" as NodeId;
    const B2 = "3c4d5e6f-7081-4b9c-8d1e-2f3a4b5c6d7e" as NodeId;
    const doc = {
      schemaVersion: 1,
      nodes: [
        ...DOC.nodes,
        { type: "bulletItem", id: B1, children: [{ type: "text", text: "Prva izmišljena stavka", marks: [] }] },
        { type: "bulletItem", id: B2, children: [{ type: "text", text: "Druga izmišljena stavka", marks: [] }] },
      ],
    } as CanonicalDocument;
    const html = render({ view: { ...SHOWN, document: doc }, marks: [{ nodeId: B2, start: 0, end: 5 }] });
    expect(html.match(/<ul>/g)).toHaveLength(1);
    expect(html).toContain(`<ul><li data-node-id="${B1}">`);
    expect(html).toContain(`<li data-node-id="${B2}"><mark`);
  });

  it("draws consecutive quote paragraphs as one block quote (E1)", () => {
    const Q1 = "4d5e6f70-8192-4cad-9e2f-3a4b5c6d7e8f" as NodeId;
    const Q2 = "5e6f7081-92a3-4dbe-8f30-4b5c6d7e8f90" as NodeId;
    const quote = (id: NodeId, text: string) => ({ type: "quote", id, children: [{ type: "text", text, marks: [] }] });
    const document = { ...DOC, nodes: [DOC.nodes[0], quote(Q1, "Prvi izmišljeni citat"), quote(Q2, "Drugi izmišljeni citat"), DOC.nodes[1]] } as CanonicalDocument;
    const html = render({ view: { ...SHOWN, document }, marks: [] });
    expect(html).toContain(`<blockquote><p data-node-id="${Q1}"><span>Prvi izmišljeni citat</span></p><p data-node-id="${Q2}">`);
    expect(html.match(/<blockquote>/g)).toHaveLength(1);
    expect(html.indexOf("</blockquote>")).toBeLessThan(html.indexOf(`<p data-node-id="${P1}">`));
  });

  it.each<[string, LiveView, string]>([
    ["loading", { document: null, hash: null, empty: false, connection: "loading", submitted: false }, t.loading],
    ["empty", { document: null, hash: null, empty: true, connection: "live", submitted: false }, t.empty],
    ["signed out", { ...SHOWN, connection: "signedOut" }, t.connection.signedOut],
    ["not found", { ...SHOWN, connection: "notFound" }, t.connection.notFound],
  ])("draws no text and no note when %s", (_name, view, placeholder) => {
    const html = render({ view, marks: [MARK] });
    expect(html).not.toContain("data-node-id");
    expect(html).not.toContain(t.note);
    expect(html).toContain(placeholder);
  });

  it("labels the submitted revision as such and never as live (DAN-332, #826 A1)", () => {
    const html = render({ view: { ...SHOWN, submitted: true }, marks: [MARK] });
    expect(html).toContain(t.submitted);
    expect(html).toContain(t.submittedNote);
    expect(html).toContain(`data-node-id="${P1}"`);
    expect(html).not.toContain(t.connection.live);
    expect(html).not.toContain(t.note);
  });

  it.each<LiveView["connection"]>(["live", "retrying", "paused"])("never labels a live text as submitted (%s, #826 A6, A8)", (connection) => {
    const html = render({ view: { ...SHOWN, connection }, marks: [MARK] });
    expect(html).not.toContain(t.submitted);
    expect(html).not.toContain(t.submittedNote);
    expect(html).toContain(t.connection[connection]);
    expect(html).toContain(t.note);
  });

  it.each<LiveView["connection"]>(["retrying", "paused"])("keeps the submitted label while its own requests fail (%s, #826 A5)", (connection) => {
    const html = render({ view: { ...SHOWN, connection, submitted: true }, marks: [MARK] });
    expect(html).toContain(t.submitted);
    expect(html).toContain(t.submittedNote);
    expect(html).not.toContain(t.connection[connection]);
    expect(html).not.toContain(t.note);
  });

  it.each<LiveView["connection"]>(["signedOut", "notFound"])("draws no submitted text, label or note once stopped (%s, #826 A7)", (connection) => {
    const html = render({ view: { ...SHOWN, connection, submitted: true }, marks: [MARK] });
    expect(html).not.toContain("data-node-id");
    expect(html).not.toContain(t.submitted);
    expect(html).not.toContain(t.submittedNote);
    expect(html).toContain(t.connection[connection]);
  });

  it("stops only once the session ended or the work is not this account's", () => {
    expect(liveStopped({ ...SHOWN, connection: "retrying" })).toBe(false);
    expect(liveStopped({ ...SHOWN, connection: "paused" })).toBe(false);
    expect(liveStopped({ ...SHOWN, connection: "signedOut" })).toBe(true);
    expect(liveStopped({ ...SHOWN, connection: "notFound" })).toBe(true);
  });
});

describe("openMarks", () => {
  const placed = (id: string, state: "open" | "answered" | "resolved", range: TextRange | null): PlacedThread => ({
    thread: { id, number: 1, state, anchor: null, comments: [] }, range, pending: false,
  });

  it("marks every placed thread that is not resolved", () => {
    const other: TextRange = { nodeId: P1, start: 0, end: 7 };
    expect(openMarks([
      placed("a", "open", MARK),
      placed("b", "answered", other),
      placed("c", "resolved", MARK),
      placed("d", "open", null),
    ])).toEqual([MARK, other]);
  });
});

describe("one place draws the live text", () => {
  const source = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

  it.each(["./LiveWorkView.tsx", "../student/TeacherViewSheet.tsx"])("%s draws it only through LiveText", (path) => {
    const code = source(path);
    expect(code).toMatch(/import LiveText, \{[^}]*useLiveView[^}]*\} from "[^"]*LiveText"/);
    expect(code).toContain("<LiveText ");
    expect(code).not.toContain('role="document"');
    expect(code).not.toContain("blockSegments(");
    expect(code).not.toContain("startLiveReader(");
  });
});

// INT-26: the live text of a v3 work. Every text, source and id is invented.
describe("live text of a v3 work (INT-26)", () => {
  const V3P = "6f708192-a3b4-4cde-8f01-5c6d7e8f9a0b" as NodeId;
  const V3H = "708192a3-b4c5-4def-9012-6d7e8f9a0b1c" as NodeId;
  const SRC = "8192a3b4-c5d6-4ef0-8123-7e8f9a0b1c2d";
  const V3: CanonicalDocumentV3 = (() => {
    const result = validateVersionedDocument({
      schemaVersion: 3,
      sources: [{
        id: SRC, type: "book", authors: [{ kind: "person", family: "Izmišljenić", given: "Ana" }],
        year: 2024, title: "Izmišljena knjiga o kompostu", place: "Zagreb", publisher: "Izmišljena naklada",
      }],
      nodes: [
        { type: "heading", level: 1, id: V3H, children: [{ type: "text", text: "Uvod", marks: [] }] },
        {
          type: "paragraph", id: V3P, children: [
            { type: "text", text: "Kompost smanjuje otpad.", marks: [] },
            { type: "footnote", text: "Prema izmišljenim podacima." },
            { type: "text", text: " Vidi", marks: [] },
            { type: "crossReference", targetId: V3H },
            { type: "citation", sourceId: SRC, locator: "str. 5" },
          ],
        },
      ],
    });
    if (!result.ok || result.doc.schemaVersion !== 3) throw new Error("Invalid synthetic v3 document");
    return result.doc;
  })();
  const V3_SHOWN: LiveView = { document: V3, hash: "b".repeat(64), empty: false, connection: "live", submitted: false };
  const ORIGIN = "https://ductura.test";
  const sha256 = async (text: string) => [...new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
  )].map((b) => b.toString(16).padStart(2, "0")).join("");
  const reply = (body: string, etag: string) =>
    new Response(body, { status: 200, headers: { "content-type": "application/json", etag: `"${etag}"` } });

  it("reads the exact v3 bytes whose hash is the ETag", async () => {
    const text = canonicalizeJcs(V3);
    const read = await readLiveState("izmisljeni-rad-3", null, async () => reply(text, await sha256(text)), ORIGIN);
    expect(read).toMatchObject({ kind: "state", hash: await sha256(text), submitted: false });
    expect(read.kind === "state" && read.document).toEqual(V3);
  });

  it("still refuses a v2 document and v3 bytes the ETag does not name", async () => {
    const v2 = canonicalizeJcs({ ...V3, schemaVersion: 2, nodes: [{ type: "paragraph", id: V3P, children: [] }] });
    expect(validateVersionedDocument(JSON.parse(v2)).ok).toBe(true);
    expect(await readLiveState("izmisljeni-rad-3", null, async () => reply(v2, await sha256(v2)), ORIGIN))
      .toEqual({ kind: "unavailable" });
    const v3 = canonicalizeJcs(V3);
    expect(await readLiveState("izmisljeni-rad-3", null, async () => reply(v3, "c".repeat(64)), ORIGIN))
      .toEqual({ kind: "unavailable" });
  });

  it("draws a footnote as „[fusnota: …]” in its place, and names the source and the heading", () => {
    const html = render({ view: V3_SHOWN, marks: [] });
    expect(html).toContain(
      `<p data-node-id="${V3P}"><span>Kompost smanjuje otpad.</span>`
      + `<span data-atom="footnote"> [${t.footnote}: Prema izmišljenim podacima.]</span>`
      + `<span> Vidi</span><span data-atom="crossReference"> [${t.crossReference}: Uvod]</span>`
      + `<span data-atom="citation"> [Izmišljenić 2024, str. 5]</span></p>`,
    );
    expect(t.footnote).toBe("fusnota");
    expect(html).toContain(t.note);
  });

  it("the student and the teacher draw the same v3 markup", () => {
    const marks: TextRange[] = [{ nodeId: V3P, start: 8, end: 26 }];
    expect(render({ view: V3_SHOWN, marks })).toBe(render({ view: V3_SHOWN, marks, textRef: { current: null }, onSelect: () => {} }));
  });

  it("anchors count only the text: an atom's label is never part of a mark or an offset", () => {
    expect(blockText(V3.nodes[1]!)).toBe("Kompost smanjuje otpad. Vidi");
    // "otpad. Vid": crosses the footnote, which stays outside the mark.
    const anchor = anchorForSelection(V3, V3P, 17, 27)!;
    expect(anchor).not.toBeNull();
    const range = placeAnchor(V3, anchor)!;
    expect(range).toEqual({ nodeId: V3P, start: 17, end: 27 });
    const html = render({ view: V3_SHOWN, marks: [range] });
    expect(html).toMatch(/<mark[^>]*>otpad\.<\/mark><span data-atom="footnote">/);
    expect(html).toMatch(/<mark[^>]*> Vid<\/mark><span>i<\/span><span data-atom="crossReference">/);
    expect(html.match(/<mark/g)).toHaveLength(2);
  });

  it("an unknown source or a missing heading still says what stands there", () => {
    const doc = { ...V3, sources: [] } as unknown as CanonicalDocumentV3;
    expect(atomLabel({ type: "citation", sourceId: SRC as never }, doc)).toBe(` [${t.citationUnknown}]`);
    expect(atomLabel({ type: "crossReference", targetId: V3P }, V3)).toBe(` [${t.crossReference}]`);
  });
});
