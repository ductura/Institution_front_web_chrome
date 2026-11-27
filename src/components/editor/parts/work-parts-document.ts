import type { Node } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";

import { storableText } from "@/editor/storable-text";
import { workPartsMessages as t } from "./messages.hr";
import type { WorkParts } from "./WorkPartsDialog";

const TEXT_PARTS = ["declaration", "acknowledgments", "biography"] as const;
const DISPLAY_PARTS = ["abbreviations", "romanNumerals", "endnotes", "index"] as const;
type TextPart = typeof TEXT_PARTS[number];
export type WorkPartsDisplay = Pick<WorkParts, typeof DISPLAY_PARTS[number]>;

type Section = { from: number; body: number; to: number; text: string };
type Sections = Partial<Record<TextPart, Section>>;

function sectionsOf(doc: Node): Sections | null {
  const sections: Sections = {};
  let current: Section | undefined;
  let duplicate = false;
  doc.forEach((node, pos) => {
    if (node.type.name === "heading") {
      current = undefined;
      const key = TEXT_PARTS.find((name) => t[name] === node.textContent);
      if (!key) return;
      if (sections[key]) duplicate = true;
      const body = pos + node.nodeSize;
      current = sections[key] = { from: pos, body, to: body, text: "" };
    } else if (current) {
      current.to = pos + node.nodeSize;
    }
  });
  if (duplicate) return null;
  for (const section of Object.values(sections)) {
    section.text = doc.textBetween(section.body, section.to, "\n", "");
  }
  return sections;
}

export function readWorkParts(doc: Node, display: WorkPartsDisplay): WorkParts | null {
  const sections = sectionsOf(doc);
  if (!sections) return null;
  const part = (key: TextPart) => ({ enabled: !!sections[key], text: sections[key]?.text ?? "" });
  return { ...display, declaration: part("declaration"), acknowledgments: part("acknowledgments"), biography: part("biography") };
}

/** Updates named sections in a single editor transaction. Text in other sections stays in place. */
export function writeWorkParts(tr: Transaction, value: WorkParts): boolean {
  const sections = sectionsOf(tr.doc);
  const schema = tr.doc.type.schema;
  const { heading, paragraph } = schema.nodes;
  if (!sections || !heading || !paragraph) return false;
  for (const key of TEXT_PARTS) {
    const section = sections[key];
    const part = value[key];
    if (!part.enabled) {
      if (section) tr.delete(tr.mapping.map(section.from), tr.mapping.map(section.to));
      continue;
    }
    if (section?.text === part.text) continue;
    const input = storableText(part.text).replace(/\r\n?/g, "\n");
    const effective = key === "declaration" && !input.trim() ? t.declarationTemplate : input;
    if (section?.text === effective) continue;
    const paragraphs = effective.split("\n").map((line) => paragraph.create(null, line ? schema.text(line) : undefined));
    if (section) {
      const from = tr.mapping.map(section.body);
      const to = tr.mapping.map(section.to);
      let richContent = false;
      tr.doc.nodesBetween(from, to, (node) => {
        if (node.type !== paragraph && (!node.isText || node.marks.length > 0)) richContent = true;
      });
      if (richContent) return false;
      tr.replaceWith(from, to, paragraphs);
    } else {
      const first = tr.doc.firstChild;
      const afterTitle = first?.type === heading && first.attrs.level === 1 ? first.nodeSize : 0;
      const afterDeclaration = key === "acknowledgments" ? sectionsOf(tr.doc)?.declaration?.to : undefined;
      const pos = key === "biography" ? tr.doc.content.size : afterDeclaration ?? afterTitle;
      tr.insert(pos, [heading.create({ level: 2 }, schema.text(t[key])), ...paragraphs]);
    }
  }
  return true;
}

export function readWorkPartsDisplay(storageKey: string): WorkPartsDisplay {
  let stored: Partial<WorkPartsDisplay> | null = null;
  try {
    stored = JSON.parse(localStorage.getItem(storageKey) ?? "null");
  } catch {
    // Missing or unreadable preferences use the default display.
  }
  return {
    abbreviations: stored?.abbreviations === true, romanNumerals: stored?.romanNumerals === true,
    endnotes: stored?.endnotes === true, index: stored?.index === true,
  };
}

// ED-79: what is drawn from the display parts on the sheet (the "Popis kratica" box) hears a change at once.
const displayListeners = new Set<() => void>();

export function subscribeWorkPartsDisplay(listener: () => void): () => void {
  displayListeners.add(listener);
  return () => { displayListeners.delete(listener); };
}

export function writeWorkPartsDisplay(storageKey: string, current: WorkPartsDisplay, next: WorkPartsDisplay): boolean {
  if (DISPLAY_PARTS.every((key) => next[key] === current[key])) return true;
  const display = Object.fromEntries(DISPLAY_PARTS.map((key) => [key, next[key]]));
  try {
    localStorage.setItem(storageKey, JSON.stringify(display));
  } catch {
    return false;
  }
  for (const listener of displayListeners) listener();
  return true;
}
