// PIL-P1-PODUDARANJE-PROVJERA-WEB: when the editor sends a paragraph. The port is a fake; the
// paragraphs and ids are invented.
import { Schema } from "@tiptap/pm/model";
import { describe, expect, it, vi } from "vitest";

import type { Segment, SegmentCheck, SegmentPort } from "@/client/assistant-match";

import { createSegmentSender, MAX_SEGMENTS_PER_SAVE, segmentsOfDocument } from "./segment-checks";

const DOC = "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d01";
const A = "Prvi izmišljeni odlomak ima dovoljno riječi za jednu provjeru teksta.";
const B = "Drugi izmišljeni odlomak također ima dovoljno riječi za jednu provjeru.";
const B2 = `${B} Dodana rečenica nakon spremanja.`;

function fakePort(answer: SegmentCheck = { kind: "checked", matches: 0 }) {
  return vi.fn<SegmentPort>(async () => answer);
}

function sender(port: SegmentPort, allowed = () => true) {
  const onMatched = vi.fn();
  return { s: createSegmentSender({ documentId: DOC, port, allowed, onMatched }), onMatched };
}

describe("segmentsOfDocument", () => {
  const schema = new Schema({
    nodes: {
      doc: { content: "block+" },
      paragraph: { group: "block", content: "text*", attrs: { nodeId: { default: null } } },
      bulletList: { group: "block", content: "paragraph+", attrs: { nodeId: { default: null } } },
      text: {},
    },
  });
  const p = (nodeId: string | null, text: string) => schema.nodes.paragraph!.create({ nodeId }, text ? schema.text(text) : undefined);

  it("every text block with its block id, in order, also inside a list; a block without an id is left out", () => {
    const doc = schema.nodes.doc!.create(null, [
      p("p-1", A),
      schema.nodes.bulletList!.create({ nodeId: "l-1" }, [p("p-2", B)]),
      p(null, "Bez oznake."),
      p("p-3", ""),
    ]);
    expect(segmentsOfDocument(doc)).toEqual([{ ref: "p-1", text: A }, { ref: "p-2", text: B }, { ref: "p-3", text: "" }]);
  });
});

describe("createSegmentSender", () => {
  const opened: Segment[] = [{ ref: "p-1", text: A }, { ref: "p-2", text: B }];

  it("sends nothing before the work's text is known, and nothing that did not change", async () => {
    const port = fakePort();
    const { s } = sender(port);
    await s.saved(opened);
    s.opened(opened);
    await s.saved(opened);
    expect(port).not.toHaveBeenCalled();
  });

  it("after a confirmed save sends only the changed paragraph, once", async () => {
    const port = fakePort();
    const { s, onMatched } = sender(port);
    s.opened(opened);
    await s.saved([{ ref: "p-1", text: A }, { ref: "p-2", text: B2 }]);
    await s.saved([{ ref: "p-1", text: A }, { ref: "p-2", text: B2 }]);
    expect(port).toHaveBeenCalledTimes(1);
    expect(port).toHaveBeenCalledWith(DOC, { ref: "p-2", text: B2 });
    expect(onMatched).not.toHaveBeenCalled();
  });

  it("an answer with matches asks the notice to read again", async () => {
    const { s, onMatched } = sender(fakePort({ kind: "checked", matches: 2 }));
    s.opened(opened);
    await s.saved([{ ref: "p-1", text: A }, { ref: "p-2", text: B2 }]);
    expect(onMatched).toHaveBeenCalledTimes(1);
  });

  it("sends nothing while writing is not allowed (submitted, replay, read-only, signed out)", async () => {
    const port = fakePort({ kind: "checked", matches: 1 });
    const { s, onMatched } = sender(port, () => false);
    s.opened(opened);
    await s.saved([{ ref: "p-1", text: A }, { ref: "p-2", text: B2 }]);
    expect(port).not.toHaveBeenCalled();
    expect(onMatched).not.toHaveBeenCalled();
  });

  it("stops between paragraphs once writing closes", async () => {
    let open = true;
    const port = vi.fn<SegmentPort>(async () => { open = false; return { kind: "checked", matches: 0 }; });
    const { s } = sender(port, () => open);
    s.opened(opened);
    await s.saved([{ ref: "p-1", text: `${A} x` }, { ref: "p-2", text: B2 }]);
    expect(port).toHaveBeenCalledTimes(1);
  });

  it("a failed send is tried again after the next save", async () => {
    const port = vi.fn<SegmentPort>()
      .mockResolvedValueOnce({ kind: "failed" })
      .mockResolvedValue({ kind: "checked", matches: 0 });
    const { s } = sender(port);
    s.opened(opened);
    await s.saved([{ ref: "p-1", text: A }, { ref: "p-2", text: B2 }]);
    await s.saved([{ ref: "p-1", text: A }, { ref: "p-2", text: B2 }]);
    expect(port).toHaveBeenCalledTimes(2);
    expect(port.mock.calls.map((c) => c[1].ref)).toEqual(["p-2", "p-2"]);
  });

  it.each(["signedOut", "off"] as const)("after %s sends nothing more for this work", async (kind) => {
    const port = fakePort({ kind });
    const { s } = sender(port);
    s.opened(opened);
    await s.saved([{ ref: "p-1", text: `${A} x` }, { ref: "p-2", text: B2 }]);
    await s.saved([{ ref: "p-1", text: `${A} y` }]);
    expect(port).toHaveBeenCalledTimes(1);
  });

  it("sends at most a bounded number of paragraphs per save; the rest go with the next save", async () => {
    const port = fakePort();
    const { s } = sender(port);
    s.opened([]);
    const many = Array.from({ length: MAX_SEGMENTS_PER_SAVE + 3 }, (_, i) => ({ ref: `p-${i}`, text: A }));
    await s.saved(many);
    expect(port).toHaveBeenCalledTimes(MAX_SEGMENTS_PER_SAVE);
    await s.saved(many);
    expect(port).toHaveBeenCalledTimes(MAX_SEGMENTS_PER_SAVE + 3);
  });

  it("a save confirmed during a send waits for it and is sent after, never in parallel", async () => {
    let release: (() => void) | undefined;
    let inFlight = 0;
    let most = 0;
    const port = vi.fn<SegmentPort>(async () => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      if (release === undefined) await new Promise<void>((r) => { release = r; });
      inFlight -= 1;
      return { kind: "checked", matches: 0 };
    });
    const { s } = sender(port);
    s.opened(opened);
    const first = s.saved([{ ref: "p-1", text: `${A} x` }, { ref: "p-2", text: B }]);
    await Promise.resolve();
    const second = s.saved([{ ref: "p-1", text: `${A} x` }, { ref: "p-2", text: B2 }]);
    release?.();
    await Promise.all([first, second]);
    expect(most).toBe(1);
    expect(port.mock.calls.map((c) => c[1])).toEqual([{ ref: "p-1", text: `${A} x` }, { ref: "p-2", text: B2 }]);
  });
});
