/**
 * The nodes and marks of document v4 (docs/contracts/document-schema-v4.md
 * §2 to §5, the last paragraph of §9 and "Za klijenta"). Each node and mark
 * is named like its canonical `type`, and its attributes are the canonical
 * fields (absent optional ones `null`), so the editor's JSON is the JSON of
 * the v4 replayer and `interop-v4.ts` projects it without renaming.
 *
 *   - `codeBlock`: text only, of marks only `paste` and `imported`; Tab
 *     writes four spaces, pasted content is plain text (`code`).
 *   - `box`: one or more paragraphs, never another box (`paragraph+`).
 *   - `table`, `image`, `formula`, `pageBreak`: atom blocks, one position,
 *     drawn as plain DOM (no KaTeX: a formula shows its `tex`).
 *   - `inlineFormula`: an inline atom like the citation; the citation's guard
 *     (citation.ts) keeps marks off it and keeps it out of a heading and a
 *     code block.
 *   - marks `sup` and `sub` exclude each other; `link`, `paste` and
 *     `imported` are not inclusive, so typing at the end of such a run does
 *     not extend it.
 *   - `paste` and `imported` enter only with the text a step inserts and
 *     leave only with it (✓ B-7, §3.1, §9.6): a transaction that adds or
 *     removes either as a mark step is refused (`createProvenanceGuard`).
 *
 * Every command tidies what it writes the way the client must before saving
 * ("Za klijenta"): text trimmed, a line break in a formula or a table cell
 * made a space, an empty optional field left out, an empty formula never
 * inserted. What it cannot tidy into a valid value it refuses (returns
 * false); `validateDocumentV4` decides validity, so the two never differ.
 * Pasted HTML is read only when its data validates; anything else is dropped.
 */

import { Extension, Mark, mergeAttributes, Node, type Editor } from "@tiptap/core";
import Paragraph from "@tiptap/extension-paragraph";
import type { DOMOutputSpec, NodeRange, Node as PmNode, ResolvedPos } from "@tiptap/pm/model";
import { NodeSelection, Plugin, PluginKey, Selection, type Transaction } from "@tiptap/pm/state";
import { AddMarkStep, AddNodeMarkStep, RemoveMarkStep, RemoveNodeMarkStep, type Step } from "@tiptap/pm/transform";

import {
  BOX_KINDS,
  CODE_LANGUAGES,
  DOCUMENT_SCHEMA_VERSION_V4,
  isSourceId,
  MAX_CODE_CAPTION_CODE_POINTS,
  MAX_INLINE_FORMULA_TEX_CODE_POINTS,
  validateDocumentV4,
  validateMarksV4,
  type BoxKind,
  type CodeLanguage,
  type MarkV4,
  type NodeId,
} from "../document/document";
import { isAllowedTrimmedText } from "../document/document/forbidden";
import {
  BLOCK_ATOM_FIELDS,
  blockAtomFromAttrs,
  blockAtomToAttrs,
  isBlockAtomType,
  type BlockAtomNode,
  type BlockAtomType,
} from "./interop-v4";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    paragraphV4: { setVariantGroup: (group: string | null) => ReturnType };
    codeBlock: {
      setCodeBlock: (language?: CodeLanguage | null) => ReturnType;
      setCodeBlockLanguage: (language: CodeLanguage | null) => ReturnType;
      setCodeBlockCaption: (caption: string | null) => ReturnType;
    };
    box: { wrapBox: (kind: BoxKind) => ReturnType; unwrapBox: () => ReturnType; setBoxKind: (kind: BoxKind) => ReturnType };
    blockAtoms: {
      insertTable: (table: TableInput) => ReturnType;
      insertImage: (image: ImageInput) => ReturnType;
      insertFormula: (tex: string) => ReturnType;
      insertPageBreak: () => ReturnType;
      updateBlockAtom: (fields: Record<string, unknown>) => ReturnType;
    };
    inlineFormula: { insertInlineFormula: (tex: string) => ReturnType };
    supSub: { toggleSup: () => ReturnType; toggleSub: () => ReturnType };
    attributeMarks: {
      setHighlight: (color: string) => ReturnType;
      unsetHighlight: () => ReturnType;
      setLang: (lang: string) => ReturnType;
      unsetLang: () => ReturnType;
      setLink: (href: string) => ReturnType;
      unsetLink: () => ReturnType;
    };
  }
}

/** The table a command inserts; flags default to the prototype's (header on). */
export type TableInput = {
  rows: string[][];
  header?: boolean;
  stripes?: boolean;
  landscape?: boolean;
  headerFill?: string;
  title?: string;
  source?: string;
};
/** The image a command inserts; it shows no bytes, only its attachment's id. */
export type ImageInput = {
  widthPercent?: number;
  align?: "left" | "center" | "right";
  landscape?: boolean;
  attachmentId?: string;
  attachmentSha256?: string;
  title?: string;
  source?: string;
};

/**
 * Core extensions of an editor built from `createEditorExtensionsV4`: Tiptap's
 * own extension named `paste` (which only emits a paste event nobody here
 * reads) would share its name with the `paste` mark of the contract.
 */
export const V4_CORE_EXTENSIONS = { paste: false } as const;

/** A line break becomes a space and the edges are trimmed (contract "Za klijenta"). */
export function tidyText(value: string): string {
  return value.replace(/\r\n|[\r\n]/g, " ").trim();
}

/** Text fields tidied, table cells without line breaks, empty optional fields left out. */
function tidyFields(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    const tidy =
      typeof value === "string" ? tidyText(value)
      : key === "rows" && Array.isArray(value)
        ? value.map((row: unknown) => (Array.isArray(row) ? row.map((cell) => (typeof cell === "string" ? cell.replace(/\r\n|[\r\n]/g, " ") : cell)) : row))
        : value;
    if (tidy === undefined || tidy === null || (key !== "tex" && (tidy === "" || (Array.isArray(tidy) && tidy.length === 0)))) continue;
    out[key] = tidy;
  }
  return out;
}

const PROBE_ID = "00000000-0000-4000-8000-000000000000" as NodeId;

/** The atom block of `type` with `fields` as `validateDocumentV4` reads it, or null. */
export function validBlockAtom(type: BlockAtomType, fields: Record<string, unknown>): BlockAtomNode | null {
  const result = validateDocumentV4({
    schemaVersion: DOCUMENT_SCHEMA_VERSION_V4,
    sources: [],
    nodes: [{ ...fields, type, id: PROBE_ID }],
  });
  return result.ok ? (result.doc.nodes[0] as BlockAtomNode) : null;
}

/** True when the mark (canonical form) is valid by contract §3. */
function validMark(mark: MarkV4): boolean {
  return validateMarksV4([mark], "$", []) !== null;
}

/* ----------------------------------------------------------- text blocks */

/** The v4 paragraph: the Tiptap paragraph with `variantGroup` (§2.1). */
export const ParagraphV4 = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      variantGroup: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const group = element.getAttribute("data-variant-group");
          return isSourceId(group) ? group : null;
        },
        renderHTML: (attributes: Record<string, unknown>) =>
          typeof attributes.variantGroup === "string" ? { "data-variant-group": attributes.variantGroup } : {},
      },
    };
  },
  addCommands() {
    return {
      ...this.parent?.(),
      setVariantGroup:
        (group: string | null) =>
        ({ commands }) =>
          (group === null || isSourceId(group)) && commands.updateAttributes(this.name, { variantGroup: group }),
    };
  },
});

const isCodeLanguage = (value: unknown): value is CodeLanguage => (CODE_LANGUAGES as readonly unknown[]).includes(value);
const isBoxKind = (value: unknown): value is BoxKind => (BOX_KINDS as readonly unknown[]).includes(value);

/** Tab in a code block writes four spaces (§4.2); elsewhere it is left to the editor. */
export function codeBlockTab(editor: Editor): boolean {
  if (editor.state.selection.$from.parent.type.name !== "codeBlock") return false;
  return editor.commands.command(({ tr }) => {
    tr.insertText("    ");
    return true;
  });
}

export const CodeBlock = Node.create({
  name: "codeBlock",
  group: "block",
  content: "text*",
  marks: "paste imported",
  code: true,
  defining: true,

  addAttributes() {
    return {
      language: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const language = element.getAttribute("data-language");
          return isCodeLanguage(language) ? language : null;
        },
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.language ? { "data-language": attributes.language } : {},
      },
      caption: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const caption = element.getAttribute("data-caption");
          return isAllowedTrimmedText(caption, MAX_CODE_CAPTION_CODE_POINTS) ? caption : null;
        },
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.caption ? { "data-caption": attributes.caption } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "pre", preserveWhitespace: "full" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["pre", HTMLAttributes, ["code", {}, 0]];
  },

  addCommands() {
    return {
      setCodeBlock:
        (language = null) =>
        ({ commands }) =>
          (language === null || isCodeLanguage(language)) && commands.setNode(this.name, { language }),
      setCodeBlockLanguage:
        (language) =>
        ({ commands }) =>
          (language === null || isCodeLanguage(language)) && commands.updateAttributes(this.name, { language }),
      setCodeBlockCaption:
        (caption) =>
        ({ commands }) => {
          const tidy = caption === null ? "" : tidyText(caption);
          if (tidy !== "" && !isAllowedTrimmedText(tidy, MAX_CODE_CAPTION_CODE_POINTS)) return false;
          return commands.updateAttributes(this.name, { caption: tidy === "" ? null : tidy });
        },
    };
  },

  addKeyboardShortcuts() {
    return { Tab: () => codeBlockTab(this.editor) };
  },
});

/** The range of all paragraphs of the box around `$pos`, or null outside a box. */
function boxContent($pos: ResolvedPos): NodeRange | null {
  for (let depth = $pos.depth; depth > 0; depth--) {
    if ($pos.node(depth).type.name === "box") {
      const doc = $pos.doc;
      return doc.resolve($pos.start(depth)).blockRange(doc.resolve($pos.end(depth)));
    }
  }
  return null;
}

export const Box = Node.create({
  name: "box",
  group: "block",
  content: "paragraph+",
  defining: true,

  addAttributes() {
    return {
      kind: {
        isRequired: true,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-box"),
        renderHTML: (attributes: Record<string, unknown>) => ({ "data-box": attributes.kind }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-box]", getAttrs: (element) => (isBoxKind(element.getAttribute("data-box")) ? null : false) }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", HTMLAttributes, 0];
  },

  addCommands() {
    return {
      wrapBox:
        (kind) =>
        ({ commands }) =>
          isBoxKind(kind) && commands.wrapIn(this.name, { kind }),
      unwrapBox:
        () =>
        ({ tr, dispatch }) => {
          const range = boxContent(tr.selection.$from);
          if (!range) return false;
          if (dispatch) tr.lift(range, range.depth - 1);
          return true;
        },
      setBoxKind:
        (kind) =>
        ({ commands, editor }) =>
          isBoxKind(kind) && editor.isActive(this.name) && commands.updateAttributes(this.name, { kind }),
    };
  },
});

/* ------------------------------------------------------------ atom blocks */

/** An attribute set by the node's own `getAttrs`, never read from an HTML attribute of its name. */
const field = (required: boolean) => ({
  ...(required ? { isRequired: true } : { default: null }),
  rendered: false,
  parseHTML: () => undefined,
});

const REQUIRED: Readonly<Record<BlockAtomType, readonly string[]>> = {
  table: ["rows", "header", "stripes", "landscape"],
  image: ["widthPercent", "align", "landscape"],
  formula: ["tex"],
  pageBreak: [],
};

/** Attributes of a pasted atom block from its `data-fields`, or false when they do not validate. */
function attrsFromHtml(type: BlockAtomType, element: HTMLElement): Record<string, unknown> | false {
  try {
    const fields: unknown = JSON.parse(element.getAttribute("data-fields") ?? "{}");
    if (typeof fields !== "object" || fields === null || Array.isArray(fields)) return false;
    const node = validBlockAtom(type, fields as Record<string, unknown>);
    return node ? blockAtomToAttrs(node) : false;
  } catch {
    return false;
  }
}

function drawTable(fields: Record<string, unknown>): DOMOutputSpec {
  const rows = (fields.rows ?? []) as string[][];
  const cell = (r: number) => (fields.header === true && r === 0 ? "th" : "td");
  const body = rows.map((row, r) => ["tr", {}, ...row.map((text) => [cell(r), {}, text])]);
  return ["table", {}, ["tbody", {}, ...body]] as unknown as DOMOutputSpec;
}

const DRAW: Readonly<Record<BlockAtomType, (fields: Record<string, unknown>) => DOMOutputSpec>> = {
  table: drawTable,
  image: (fields) => ["span", {}, typeof fields.title === "string" ? fields.title : "Slika"],
  formula: (fields) => ["code", {}, String(fields.tex ?? "")],
  pageBreak: () => ["hr", {}],
};

function blockAtom(type: BlockAtomType) {
  return Node.create({
    name: type,
    group: "block",
    atom: true,
    selectable: true,

    addAttributes() {
      return Object.fromEntries(BLOCK_ATOM_FIELDS[type].map((key) => [key, field(REQUIRED[type].includes(key))]));
    },

    parseHTML() {
      return [{ tag: `div[data-atom="${type}"]`, getAttrs: (element) => attrsFromHtml(type, element) }];
    },

    renderHTML({ node, HTMLAttributes }) {
      const fields = blockAtomFromAttrs(type, node.attrs);
      return [
        "div",
        mergeAttributes(HTMLAttributes, { "data-atom": type, "data-fields": JSON.stringify(fields) }),
        DRAW[type](fields),
      ];
    },
  });
}

export const Table = blockAtom("table");
export const Image = blockAtom("image");
export const Formula = blockAtom("formula");
export const PageBreak = blockAtom("pageBreak");

/**
 * Inserts a valid atom block at the selection and puts the cursor after it,
 * so that the next insertion does not replace it; false when the fields do
 * not validate.
 */
function insertBlockAtom(commands: Editor["commands"], type: BlockAtomType, fields: Record<string, unknown>): boolean {
  const node = validBlockAtom(type, tidyFields(fields));
  return (
    node !== null &&
    commands.insertContent({ type, attrs: blockAtomToAttrs(node) }) &&
    commands.command(({ tr }) => {
      const { $to } = tr.selection;
      // Last in its parent: an empty paragraph after it, as a horizontal rule gets.
      if (!$to.nodeAfter) tr.insert($to.pos, tr.doc.type.schema.nodes.paragraph!.create());
      tr.setSelection(Selection.near(tr.doc.resolve($to.pos), 1));
      return true;
    })
  );
}

/**
 * The commands of the atom blocks. A change of an atom's fields replaces the
 * node with one of the same type and `nodeId` (§9.3).
 */
export const BlockAtomCommands = Extension.create({
  name: "blockAtomCommands",

  addCommands() {
    return {
      insertTable:
        (table) =>
        ({ commands }) =>
          insertBlockAtom(commands, "table", { header: true, stripes: false, landscape: false, ...table }),
      insertImage:
        (image) =>
        ({ commands }) =>
          insertBlockAtom(commands, "image", { widthPercent: 100, align: "center", landscape: false, ...image }),
      insertFormula:
        (tex) =>
        ({ commands }) =>
          insertBlockAtom(commands, "formula", { tex }),
      insertPageBreak:
        () =>
        ({ commands }) =>
          insertBlockAtom(commands, "pageBreak", {}),
      updateBlockAtom:
        (fields) =>
        ({ tr, dispatch }) => {
          const { selection } = tr;
          if (!(selection instanceof NodeSelection) || !isBlockAtomType(selection.node.type.name)) return false;
          const type = selection.node.type.name as BlockAtomType;
          const merged = { ...blockAtomFromAttrs(type, selection.node.attrs), ...fields };
          const node = validBlockAtom(type, tidyFields(merged));
          if (!node) return false;
          if (dispatch) tr.setNodeMarkup(selection.from, undefined, { ...selection.node.attrs, ...blockAtomToAttrs(node) });
          return true;
        },
    };
  },
});

export const InlineFormula = Node.create({
  name: "inlineFormula",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      tex: {
        isRequired: true,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-tex"),
        renderHTML: (attributes: Record<string, unknown>) => ({ "data-tex": attributes.tex }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-inline-formula]",
        getAttrs: (element) =>
          isAllowedTrimmedText(element.getAttribute("data-tex"), MAX_INLINE_FORMULA_TEX_CODE_POINTS) ? null : false,
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ["span", mergeAttributes({ "data-inline-formula": "" }, HTMLAttributes), ["code", {}, String(node.attrs.tex)]];
  },

  addCommands() {
    return {
      insertInlineFormula:
        (tex) =>
        ({ tr, dispatch }) => {
          const tidy = tidyText(tex);
          const { $from, $to, from, to } = tr.selection;
          if (
            !isAllowedTrimmedText(tidy, MAX_INLINE_FORMULA_TEX_CODE_POINTS) ||
            !$from.sameParent($to) ||
            !$from.parent.canReplaceWith($from.index(), $to.index(), this.type)
          ) {
            return false;
          }
          if (dispatch) tr.replaceWith(from, to, this.type.create({ tex: tidy }));
          return true;
        },
    };
  },
});

/* ------------------------------------------------------------------ marks */

export const Sup = Mark.create({
  name: "sup",
  excludes: "sup sub",
  parseHTML: () => [{ tag: "sup" }],
  renderHTML: ({ HTMLAttributes }) => ["sup", HTMLAttributes, 0],
  addCommands() {
    return { toggleSup: () => ({ commands }) => commands.toggleMark(this.name) };
  },
});

export const Sub = Mark.create({
  name: "sub",
  excludes: "sup sub",
  parseHTML: () => [{ tag: "sub" }],
  renderHTML: ({ HTMLAttributes }) => ["sub", HTMLAttributes, 0],
  addCommands() {
    return { toggleSub: () => ({ commands }) => commands.toggleMark(this.name) };
  },
});

/** A mark with one required attribute, read from and written to `html`. */
function attributeMark(name: "highlight" | "lang" | "link", attribute: string, html: string, tag: string) {
  return Mark.create({
    name,
    inclusive: name !== "link",
    addAttributes() {
      return {
        [attribute]: {
          isRequired: true,
          parseHTML: (element: HTMLElement) => element.getAttribute(html),
          renderHTML: (attributes: Record<string, unknown>) => ({ [html]: attributes[attribute] }),
        },
      };
    },
    parseHTML() {
      return [
        {
          tag: `${tag}[${html}]`,
          getAttrs: (element) =>
            validMark({ type: name, [attribute]: element.getAttribute(html) } as MarkV4) ? null : false,
        },
      ];
    },
    renderHTML({ HTMLAttributes }) {
      return [tag, name === "link" ? mergeAttributes(HTMLAttributes, { rel: "noopener noreferrer nofollow" }) : HTMLAttributes, 0];
    },
  });
}

/** Sets the mark `name` with `value` when it is valid; false otherwise. */
const setValid =
  (name: "highlight" | "lang" | "link", attribute: string) =>
  (value: string) =>
  ({ commands }: { commands: Editor["commands"] }) =>
    validMark({ type: name, [attribute]: value } as MarkV4) && commands.setMark(name, { [attribute]: value });

export const Highlight = attributeMark("highlight", "color", "data-color", "mark").extend({
  addCommands() {
    return { setHighlight: setValid("highlight", "color"), unsetHighlight: () => ({ commands }) => commands.unsetMark(this.name) };
  },
});

export const Lang = attributeMark("lang", "lang", "lang", "span").extend({
  addCommands() {
    return { setLang: setValid("lang", "lang"), unsetLang: () => ({ commands }) => commands.unsetMark(this.name) };
  },
});

export const Link = attributeMark("link", "href", "href", "a").extend({
  addCommands() {
    return { setLink: setValid("link", "href"), unsetLink: () => ({ commands }) => commands.unsetMark(this.name) };
  },
});

/* ------------------------------------------------------- provenance marks */

const PROVENANCE = new Set(["paste", "imported"]);

/**
 * A step that adds or removes `paste` or `imported` as a mark. One exception:
 * the citation guard takes every mark off a single inline atom, which holds
 * none by contract, so that step passes.
 */
function movesProvenanceMark(step: Step, doc: PmNode): boolean {
  if (
    !(step instanceof AddMarkStep || step instanceof RemoveMarkStep || step instanceof AddNodeMarkStep || step instanceof RemoveNodeMarkStep) ||
    !PROVENANCE.has(step.mark.type.name)
  ) {
    return false;
  }
  if (step instanceof RemoveMarkStep && step.to === step.from + 1) {
    const node = doc.nodeAt(step.from);
    return !(node && node.isInline && node.isAtom && !node.isText);
  }
  return true;
}

const provenanceKey = new PluginKey<null>("provenanceGuard");

/** Refuses every transaction that adds or removes `paste` or `imported` with a mark step. */
export function createProvenanceGuard(): Plugin {
  return new Plugin({
    key: provenanceKey,
    filterTransaction: (tr: Transaction) => !tr.steps.some((step, i) => movesProvenanceMark(step, tr.docs[i]!)),
  });
}

export const Paste = Mark.create({
  name: "paste",
  inclusive: false,
  addAttributes() {
    return {
      pasteId: {
        isRequired: true,
        parseHTML: () => undefined,
        renderHTML: (attributes: Record<string, unknown>) => ({ "data-paste-id": attributes.pasteId }),
      },
      sourceId: {
        default: null,
        parseHTML: () => undefined,
        renderHTML: (attributes: Record<string, unknown>) =>
          typeof attributes.sourceId === "string" ? { "data-source-id": attributes.sourceId } : {},
      },
    };
  },
  // Never read from HTML: only the editor's own paste gives the mark.
  parseHTML: () => [],
  renderHTML: ({ HTMLAttributes }) => ["span", HTMLAttributes, 0],
  addProseMirrorPlugins() {
    return [createProvenanceGuard()];
  },
});

export const Imported = Mark.create({
  name: "imported",
  inclusive: false,
  parseHTML: () => [],
  renderHTML: ({ HTMLAttributes }) => ["span", mergeAttributes(HTMLAttributes, { "data-imported": "" }), 0],
});
