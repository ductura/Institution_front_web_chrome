// ED-130: the teacher's text checks find the student's words again and anchor a comment on them.
import { describe, expect, it } from "vitest";

import { placeAnchor } from "@/components/teacher/comment-place";
import {
  DOCUMENT_SCHEMA_VERSION, headingNode, paragraphNode, quoteNode, textNode, type CanonicalDocument, type NodeId,
} from "@/domain/document";

import { textChecksHr as t } from "./messages.hr";
import { commentableFindings, commentTextOf, findingAnchor, findingRange, reviewDocOfLive } from "./model";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}` as NodeId;
const docOf = (...nodes: CanonicalDocument["nodes"]): CanonicalDocument => ({ schemaVersion: DOCUMENT_SCHEMA_VERSION, nodes });

// Invented text: a first person, a colloquial word, and a quote the checks leave alone.
const DOC = docOf(
  headingNode(id(1), 1, [textNode("Izmišljeni uvod")]),
  paragraphNode(id(2), [textNode("Ovaj izmišljeni rad opisuje gradski park i njegove staze. "), textNode("Mislim da je park važan za susjedstvo i šetače.")]),
  paragraphNode(id(3), [textNode("Park je super mjesto za odmor obitelji, djece i starijih stanovnika kvarta.")]),
  quoteNode(id(4), [textNode("Mislim da je ovo citat koji provjere ne diraju.")]),
);

describe("text checks in the teacher's view (ED-130)", () => {
  it("reads the live blocks with their chapters", () => {
    const model = reviewDocOfLive(DOC);
    expect(model.blocks.map((b) => b.kind)).toEqual(["heading", "paragraph", "paragraph", "quote"]);
    expect(model.chapters).toHaveLength(1);
    expect(model.blocks[1]!.id).toBe(id(2));
  });

  it("keeps only findings with a comment text, never one in a quote", () => {
    const findings = commentableFindings(DOC, null);
    const kinds = findings.map((f) => f.kind);
    expect(kinds).toContain("first");
    expect(kinds).toContain("colloq");
    expect(kinds).not.toContain("short");
    expect(findings.every((f) => f.blockId !== id(4))).toBe(true);
    expect(findings.every((f) => commentTextOf(f.kind) !== null)).toBe(true);
  });

  it("gives the prototype's first line for a kind, and none for a kind without one", () => {
    expect(commentTextOf("colloq")).toBe(t.comment.colloq);
    expect(commentTextOf("num")).toBe(t.comment.num);
    expect(commentTextOf("short")).toBeNull();
    expect(commentTextOf("hole")).toBeNull();
  });

  it("anchors the comment on the words of the finding, across text nodes", () => {
    const first = commentableFindings(DOC, null).find((f) => f.kind === "first")!;
    const anchor = findingAnchor(DOC, first)!;
    expect(anchor.nodeId).toBe(id(2));
    expect(anchor.quote).toContain("Mislim");
    expect(placeAnchor(DOC, anchor)).not.toBeNull();
  });

  it("takes the start of the block when the words are no longer there", () => {
    const colloq = commentableFindings(DOC, null).find((f) => f.kind === "colloq")!;
    const changed = docOf(...DOC.nodes.map((n) => (n.id === id(3) ? paragraphNode(id(3), [textNode("Posve drukčiji izmišljeni tekst istog odlomka.")]) : n)));
    expect(findingRange(changed, colloq)).toEqual({ nodeId: id(3), start: 0, end: "Posve drukčiji izmišljeni tekst istog odlomka.".length });
    expect(findingAnchor(changed, colloq)?.nodeId).toBe(id(3));
  });

  it("has no anchor when the block is gone or empty", () => {
    const colloq = commentableFindings(DOC, null).find((f) => f.kind === "colloq")!;
    expect(findingAnchor(docOf(DOC.nodes[0]!, DOC.nodes[1]!), colloq)).toBeNull();
    expect(findingAnchor(docOf(DOC.nodes[0]!, paragraphNode(id(3), [])), colloq)).toBeNull();
  });
});
