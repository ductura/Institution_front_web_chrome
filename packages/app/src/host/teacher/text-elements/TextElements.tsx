"use client";

import type { ReactNode } from "react";

import { blockRuns } from "@/components/shell/manuscript-blocks";
import { buildElements, type Block, type Elements, type Piece } from "./model";
import { textElementsMessages as text } from "./messages.hr";
import styles from "./TextElements.module.css";

function piece(p: Piece, i: number): ReactNode {
  switch (p.kind) {
    case "text": {
      let content: ReactNode = p.text;
      if (p.marks.includes("italic")) content = <em>{content}</em>;
      if (p.marks.includes("bold")) content = <strong>{content}</strong>;
      return <span key={i}>{content}</span>;
    }
    case "cite": return <span key={i} data-atom="citation" className={styles.cite} title={text.citationTitle}>{p.label}</span>;
    case "open": return <span key={i} data-atom="citation" className={styles.open} title={text.openSourceTitle}>{text.openSource}</span>;
    case "note": return <sup key={i} data-atom="footnote" id={`fn-ref-${p.number}`}><a href={`#fn-${p.number}`} aria-label={text.noteMark(p.number)}>{p.number}</a></sup>;
    case "ref": return null;
  }
}

function block(b: Block): ReactNode {
  const kids = b.pieces.map(piece);
  if (b.type === "heading") {
    const H = b.level === 1 ? "h2" : b.level === 2 ? "h3" : "h4";
    return <H key={b.id} data-node-id={b.id}>{kids}</H>;
  }
  if (b.type === "bulletItem") return <li key={b.id} data-node-id={b.id}>{kids}</li>;
  return <p key={b.id} data-node-id={b.id}>{kids}</p>;
}

/** The text of a work with citation, open source place and footnotes drawn; read-only. */
export function TextElementsView({ elements }: { elements: Elements }) {
  const runs = blockRuns(elements.blocks.map((b) => ({ ...b, children: [] })) as never);
  const byId = new Map(elements.blocks.map((b) => [b.id, b]));
  const draw = (id: string) => block(byId.get(id)!);
  return (
    <>
      {runs.map((run) =>
        run.kind === "list" ? <ul key={run.items[0]!.id}>{run.items.map((n) => draw(n.id))}</ul>
          : run.kind === "quote" ? <blockquote key={run.items[0]!.id}>{run.items.map((n) => draw(n.id))}</blockquote>
          : draw(run.node.id))}
      {elements.notes.length > 0 && (
        <div className={styles.notes} role="doc-endnotes" aria-label={text.notesLabel}>
          {elements.notes.map((n) => (
            <p key={n.number} id={`fn-${n.number}`}><sup>{n.number}</sup> {n.text}{" "}
              <a href={`#fn-ref-${n.number}`} aria-label={text.noteBack(n.number)}>↩</a></p>
          ))}
        </div>
      )}
    </>
  );
}

export { buildElements };
