"use client";

import type { ReactNode } from "react";
import "katex/dist/katex.min.css";

import type {
  CanonicalDocumentV4, DocumentNodeV4, InlineNodeV4, ParagraphNodeV4, TextNodeV4,
} from "../../../../../../editor-core/src/document/document/schema.ts";
import { numberedListNumbers } from "../../../../../../editor-core/src/lists/numbering.ts";
import { renderTex } from "../../../editor/formula/render.ts";
import { v4ViewMessages as text } from "./messages.hr";

/**
 * A submitted v4 document for the teacher, read only (WEB-V21-STEM-NASTAVNIK-PRIKAZ): formula (KaTeX,
 * local), code with line numbers (never run), box, table and the place of an image (the picture is
 * not fetched here). Nothing is editable and no link is followed: a link mark shows its text only.
 */
export default function V4Blocks({ document }: { document: CanonicalDocumentV4 }) {
  const numbers = numberedListNumbers(document.nodes);
  return <article data-v4="true">{document.nodes.map((node, i) => <Block key={node.id ?? i} node={node} number={numbers[i] ?? null} />)}</article>;
}

function Block({ node, number }: { node: DocumentNodeV4; number: string | null }): ReactNode {
  switch (node.type) {
    case "heading": return <h4><Texts nodes={node.children} /></h4>;
    case "paragraph": return <p><Inlines nodes={node.children} /></p>;
    case "bulletItem": return <p>• <Inlines nodes={node.children} /></p>;
    case "numberedItem": {
      // The number is derived from the block order (never stored), as the editor and the export do.
      const depth = Math.min(3, Math.max(1, node.level)) - 1;
      return <p data-level={node.level} style={{ paddingInlineStart: `${depth * 1.5}em` }}>{number} <Inlines nodes={node.children} /></p>;
    }
    case "quote": return <blockquote><Inlines nodes={node.children} /></blockquote>;
    case "formula": return <Formula tex={node.tex} display />;
    case "codeBlock": return <Code node={node} />;
    case "box": return <Box kind={node.kind} children={node.children} />;
    case "table": return <Table node={node} />;
    case "image": return <Figure node={node} />;
    case "pageBreak": return <hr aria-label={text.pageBreak} />;
  }
}

export function Formula({ tex, display }: { tex: string; display: boolean }) {
  const out = renderTex(tex, display);
  if (out.html === "") return <code>{tex}</code>;
  const body = <span dangerouslySetInnerHTML={{ __html: out.html }} />;
  if (out.ok) return display ? <div role="math" aria-label={text.formulaLabel}>{body}</div> : body;
  return (
    <span data-invalid="true">
      <code>{tex}</code> <small role="note">{text.formulaInvalid}</small>
    </span>
  );
}

function Texts({ nodes }: { nodes: readonly TextNodeV4[] }) {
  return <>{nodes.map((n, i) => <Run key={i} node={n} />)}</>;
}

function Run({ node }: { node: TextNodeV4 }) {
  const has = (m: string) => node.marks.some((x) => (typeof x === "string" ? x : x.type) === m);
  let out: ReactNode = node.text;
  if (has("sup")) out = <sup>{out}</sup>;
  if (has("sub")) out = <sub>{out}</sub>;
  if (has("italic")) out = <em>{out}</em>;
  if (has("bold")) out = <strong>{out}</strong>;
  return <>{out}</>;
}

function Inlines({ nodes }: { nodes: readonly InlineNodeV4[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.type) {
          case "text": return <Run key={i} node={n} />;
          case "inlineFormula": return <Formula key={i} tex={n.tex} display={false} />;
          case "citation": return <span key={i}>{text.citation}</span>;
          case "footnote": return <span key={i}>{text.footnote}</span>;
          case "crossReference": return <span key={i}>{text.crossReference}</span>;
        }
      })}
    </>
  );
}

function Code({ node }: { node: Extract<DocumentNodeV4, { type: "codeBlock" }> }) {
  const source = node.children.map((c) => c.text).join("");
  const lines = source.split("\n");
  return (
    <figure data-code="true">
      <figcaption>
        {text.codeLabel} ({node.language ?? text.codeNoLanguage}){node.caption ? `: ${node.caption}` : ""}. {text.codeRunNote}
      </figcaption>
      <pre><code>
        {lines.map((line, i) => <span key={i} data-line={i + 1}><span aria-hidden="true">{i + 1}  </span>{line}{"\n"}</span>)}
      </code></pre>
    </figure>
  );
}

function Box({ kind, children }: { kind: keyof typeof text.boxKinds; children: readonly ParagraphNodeV4[] }) {
  return (
    <aside data-box={kind}>
      <strong>{text.boxKinds[kind]}</strong>
      {children.map((p, i) => <p key={i}><Inlines nodes={p.children} /></p>)}
    </aside>
  );
}

function Table({ node }: { node: Extract<DocumentNodeV4, { type: "table" }> }) {
  const [head, ...rest] = node.rows;
  const body = node.header ? rest : node.rows;
  return (
    <table>
      <caption>{text.tableLabel}{node.title ? `: ${node.title}` : ""}{node.source ? `. ${text.source}: ${node.source}` : ""}</caption>
      {node.header && head !== undefined && <thead><tr>{head.map((c, i) => <th key={i} scope="col">{c}</th>)}</tr></thead>}
      <tbody>{body.map((row, r) => <tr key={r}>{row.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
    </table>
  );
}

function Figure({ node }: { node: Extract<DocumentNodeV4, { type: "image" }> }) {
  return (
    <figure data-image="true">
      <p role="img" aria-label={node.title ?? text.imageLabel}>{text.imageLabel}: {node.title ?? "—"}</p>
      <figcaption>{text.imagePlaceholder}{node.source ? ` ${text.source}: ${node.source}` : ""}</figcaption>
    </figure>
  );
}
