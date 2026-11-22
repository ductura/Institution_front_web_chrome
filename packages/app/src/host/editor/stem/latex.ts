// WEB-2134: the work as a LaTeX file (stem.js `buildTex`, "Izvoz u LaTeX"). A pure function of the canonical
// document v4 and the institution's citation style; the same document always gives the same bytes. Images are
// not part of the file (no attachment bytes here): a note stands in their place.
import type {
  CanonicalDocumentV4, DocumentNodeV4, DocumentSource, InlineNodeV4, MarkV4, TextNodeV4,
} from "../../../../../editor-core/src/document/document/index.ts";
import { assignYearSuffixes, formatBibliographyEntry, formatCitationInText, sortBibliography } from "../../../../../editor-core/src/document/citation/format";
import type { CitationStyle } from "../../../../../editor-core/src/document/citation/style";

import { stemHr as m } from "./messages.hr";

export type TexOptions = { readonly title: string; readonly style: CitationStyle };

const SPECIAL: Record<string, string> = { "\\": "\\textbackslash{}", "&": "\\&", "%": "\\%", "$": "\\$", "#": "\\#", _: "\\_", "{": "\\{", "}": "\\}", "~": "\\textasciitilde{}", "^": "\\textasciicircum{}" };
export const texEscape = (s: string): string => s.replace(/[\\&%$#_{}~^]/g, (c) => SPECIAL[c]!);
const hrefEscape = (s: string): string => s.replace(/[%#\\{}]/g, (c) => `\\${c}`);

const PREFIX = { heading: "sec", formula: "eq", codeBlock: "lst", box: "box", table: "tab", image: "fig" } as const;
type Target = keyof typeof PREFIX;
const labelOf = (type: Target, id: string): string => `${PREFIX[type]}:${id}`;

const BOX_ENV = { definition: "definicija", theorem: "teorem", lemma: "lema", corollary: "korolar", example: "primjer", remark: "napomena", proof: "proof" } as const;
const LISTING = { c: "C", html: "HTML", java: "Java", javascript: "JavaScript", python: "Python", r: "R", sql: "SQL" } as const;

type Ctx = {
  readonly sources: ReadonlyMap<string, DocumentSource>;
  readonly targets: ReadonlyMap<string, Target>;
  readonly style: CitationStyle;
  readonly cited: Set<string>;
};

function markText(text: string, marks: readonly MarkV4[]): string {
  let out = texEscape(text);
  for (const mark of marks) {
    if (mark === "bold") out = `\\textbf{${out}}`;
    else if (mark === "italic") out = `\\textit{${out}}`;
    else if (mark === "sup") out = `\\textsuperscript{${out}}`;
    else if (mark === "sub") out = `\\textsubscript{${out}}`;
    else if (typeof mark === "object" && mark.type === "lang") out = `\\textit{${out}}`;
    else if (typeof mark === "object" && mark.type === "link") out = `\\href{${hrefEscape(mark.href)}}{${out}}`;
  }
  return out;
}

function inline(children: readonly InlineNodeV4[], ctx: Ctx): string {
  return children.map((c) => {
    switch (c.type) {
      case "text": return markText(c.text, c.marks);
      case "inlineFormula": return `$${c.tex}$`;
      case "footnote": return `\\footnote{${texEscape(c.text)}}`;
      case "crossReference": {
        const kind = ctx.targets.get(c.targetId);
        return kind === undefined ? "[referenca?]" : `\\ref{${labelOf(kind, c.targetId)}}`;
      }
      case "citation": {
        const source = ctx.sources.get(c.sourceId);
        if (source === undefined) return "[?]";
        ctx.cited.add(c.sourceId);
        return texEscape(formatCitationInText(source, ctx.style, c.locator));
      }
    }
  }).join("");
}

const plain = (children: readonly TextNodeV4[]): string => children.map((c) => c.text).join("");

function table(node: Extract<DocumentNodeV4, { type: "table" }>): string {
  const cols = Math.max(1, ...node.rows.map((r) => r.length));
  const rows = node.rows.map((r, i) => {
    const cells = Array.from({ length: cols }, (_, j) => {
      const cell = texEscape(r[j] ?? "");
      return node.header && i === 0 ? `\\textbf{${cell}}` : cell;
    });
    return `${cells.join(" & ")} \\\\${node.header && i === 0 ? " \\hline" : ""}`;
  });
  const label = `\\label{${labelOf("table", node.id)}}`;
  const caption = node.title ? `\\caption{${texEscape(node.title)}}${label}\n` : `${label}\n`;
  const source = node.source ? `\n\\\\{\\small Izvor: ${texEscape(node.source)}}` : "";
  return `\\begin{table}[htbp]\n\\centering\n${caption}\\begin{tabular}{|${"l|".repeat(cols)}}\n\\hline\n${rows.join("\n")}\n\\hline\n\\end{tabular}${source}\n\\end{table}`;
}

function block(node: DocumentNodeV4, ctx: Ctx): string {
  switch (node.type) {
    case "heading": {
      const cmd = node.level === 1 ? "section" : node.level === 2 ? "subsection" : "subsubsection";
      return `\\${cmd}{${inline(node.children, ctx)}}\\label{${labelOf("heading", node.id)}}`;
    }
    case "paragraph": return inline(node.children, ctx);
    case "quote": return `\\begin{quote}\n${inline(node.children, ctx)}\n\\end{quote}`;
    case "bulletItem":
    case "numberedItem": return `\\item ${inline(node.children, ctx)}`;
    case "formula": return `\\begin{equation}\\label{${labelOf("formula", node.id)}}\n${node.tex}\n\\end{equation}`;
    case "codeBlock": {
      const caption = node.caption ? `,caption={${texEscape(node.caption)}}` : "";
      const lang = node.language ? `,language=${LISTING[node.language]}` : "";
      return `\\begin{lstlisting}[label={${labelOf("codeBlock", node.id)}}${caption}${lang}]\n${plain(node.children)}\n\\end{lstlisting}`;
    }
    case "box": {
      const env = BOX_ENV[node.kind];
      const body = node.children.map((p) => inline(p.children, ctx)).join("\n\n");
      return `\\begin{${env}}\\label{${labelOf("box", node.id)}}\n${body}\n\\end{${env}}`;
    }
    case "pageBreak": return "\\newpage";
    case "table": return table(node);
    case "image": {
      const caption = node.title ? `\\caption{${texEscape(node.title)}}` : "";
      return `\\begin{figure}[htbp]\n\\centering\n\\fbox{\\parbox{0.8\\textwidth}{\\centering ${m.latex.imagePlaceholder}}}\n${caption}\\label{${labelOf("image", node.id)}}\n\\end{figure}`;
    }
  }
}

const withoutId = (s: DocumentSource) => { const { id: _id, ...rest } = s; return rest; };

/** The whole `.tex` text of a work. */
export function buildTex(doc: CanonicalDocumentV4, opts: TexOptions): string {
  const targets = new Map<string, Target>();
  for (const n of doc.nodes) if (n.type in PREFIX) targets.set(n.id, n.type as Target);
  const ctx: Ctx = { sources: new Map(doc.sources.map((s) => [s.id, s])), targets, style: opts.style, cited: new Set() };

  const body: string[] = [];
  let list: "itemize" | "enumerate" | null = null;
  const close = () => { if (list !== null) { body.push(`\\end{${list}}`); list = null; } };
  for (const node of doc.nodes) {
    const want = node.type === "bulletItem" ? "itemize" : node.type === "numberedItem" ? "enumerate" : null;
    if (want !== list) { close(); if (want !== null) { body.push(`\\begin{${want}}`); list = want; } }
    body.push(block(node, ctx));
  }
  close();

  const cited = assignYearSuffixes(sortBibliography(doc.sources.filter((s) => ctx.cited.has(s.id)).map(withoutId)));
  const literature = cited.length === 0 ? [] : [
    `\\section*{${m.latex.bibliography}}`,
    "\\begin{itemize}",
    ...cited.map((s) => `\\item ${texEscape(formatBibliographyEntry(s, opts.style))}`),
    "\\end{itemize}",
  ];

  const cover = doc.cover;
  const authorLine = [cover?.study, cover?.place].filter((v): v is string => !!v).map(texEscape).join(", ");
  return [
    "\\documentclass[12pt,a4paper]{article}",
    "\\usepackage[utf8]{inputenc}",
    "\\usepackage[T1]{fontenc}",
    "\\usepackage[croatian]{babel}",
    "\\usepackage[margin=2.5cm]{geometry}",
    "\\usepackage{setspace}",
    "\\usepackage{amsmath,amssymb,amsthm}",
    "\\usepackage{graphicx}",
    "\\usepackage{listings}",
    "\\usepackage[hidelinks]{hyperref}",
    "\\onehalfspacing",
    "\\theoremstyle{definition}",
    "\\newtheorem{definicija}{Definicija}",
    "\\newtheorem{teorem}{Teorem}",
    "\\newtheorem{lema}{Lema}",
    "\\newtheorem{korolar}{Korolar}",
    "\\newtheorem{primjer}{Primjer}",
    "\\newtheorem{napomena}{Napomena}",
    "\\lstset{basicstyle=\\ttfamily\\small,breaklines=true,numbers=left,captionpos=b}",
    `\\title{${texEscape(opts.title || m.latex.untitled)}}`,
    `\\author{${authorLine}}`,
    `\\date{${cover?.date ? texEscape(cover.date) : ""}}`,
    "\\begin{document}",
    "\\maketitle",
    "\\tableofcontents",
    "\\newpage",
    "",
    // Items of one list stay on consecutive lines; everything else is a paragraph apart.
    body.join("\n\n").replace(/\n\n(\\item|\\end\{(?:itemize|enumerate)\})/g, "\n$1").replace(/(\\begin\{(?:itemize|enumerate)\})\n\n/g, "$1\n"),
    "",
    ...literature,
    "\\end{document}",
    "",
  ].join("\n");
}

/** The name of the downloaded file. */
export const TEX_FILE = "rad.tex";
