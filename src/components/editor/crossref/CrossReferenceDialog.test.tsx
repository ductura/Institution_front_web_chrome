import { renderToStaticMarkup } from "react-dom/server";
import { Schema, type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { expect, it } from "vitest";

import { CrossReferenceDialog } from "./CrossReferenceDialog";

const targetId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const read = { mode: "read", targetId, onFollow() {}, onClose() {} } as const;
const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    heading: { group: "block", content: "text*", attrs: { nodeId: { default: null }, level: { default: 1 } } },
    paragraph: { group: "block", content: "text*", attrs: { nodeId: { default: null } } },
    text: {},
  },
});
const heading = (id: string, title: string) => schema.node("heading", { nodeId: id }, schema.text(title));
const work = (...blocks: ProseMirrorNode[]) => schema.node("doc", undefined, blocks);

it("shows the target's current number after it moves", () => {
  const target = heading(targetId, "Izmišljeno poglavlje");
  const other = heading(otherId, "Drugo izmišljeno poglavlje");
  const before = renderToStaticMarkup(<CrossReferenceDialog {...read} document={work(target, other)} />);
  const html = renderToStaticMarkup(<CrossReferenceDialog {...read}
    document={work(other, target)} />);
  expect(before).toContain("Poglavlje 1 Izmišljeno poglavlje");
  expect(html).toContain("Poglavlje 2 Izmišljeno poglavlje");
  expect(html).toContain("Idi na cilj");
});

it("shows a broken reference when the block becomes a paragraph", () => {
  const html = renderToStaticMarkup(<CrossReferenceDialog {...read}
    document={work(schema.node("paragraph", { nodeId: targetId }), heading(otherId, "Izmišljeno poglavlje"))} />);
  expect(html).toContain("Poveznica nema dostupno poglavlje.");
  expect(html).not.toContain("Idi na cilj");
});
