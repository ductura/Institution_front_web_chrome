import type { Node } from "@tiptap/pm/model";

import { readRequirements, type LocalCall } from "@/client/submission";
import { countTextWords, lengthLine, wordRangeHr } from "@/lib/i18n/length-line";

import { reviewPlaces } from "../citations/review-places";
import { runChecks } from "../review/checks";
import { readReviewDoc } from "../review/model";
import { rehearsalMessagesHr as t } from "./messages.hr";

export type Requirements = Awaited<ReturnType<typeof readRequirements>> | null;

export function loadRequirements(assignmentId: string, call?: LocalCall): Promise<Requirements> {
  return call ? readRequirements(call, assignmentId) : Promise.resolve({ kind: "nepoznato" });
}

export function wordsLabel(count: number) {
  const { count: formatted, rest } = lengthLine(count, 0, null);
  return `${formatted}${rest.split(" · ", 1)[0]}`;
}

export function rangeDetail(words: number, requirements: Requirements) {
  if (requirements === null) return t.rangeLoading;
  if (requirements.kind !== "ready") return t.rangeUnavailable;
  const range = requirements.wordRange;
  if (range === null) return t.rangeNone;
  const target = t.rangeTarget.replace("{range}", wordRangeHr(range)!);
  if (words < range.min) return `${target} ${t.missingWords.replace("{words}", wordsLabel(range.min - words))}`;
  if (words > range.max) return `${target} ${t.excessWords.replace("{words}", wordsLabel(words - range.max))}`;
  return target;
}

type Part = { pos: number; text: string };
type PartName = "abstract" | "summary" | "keywords";
const NAMES = { [t.abstract.toLowerCase()]: "abstract", [t.summary.toLowerCase()]: "summary",
  [t.keywords.toLowerCase()]: "keywords" } as Readonly<Record<string, PartName | undefined>>;

/** Named sections of the open editor document, including an inline keyword label in the abstract. */
function partsOf(doc: Node) {
  const parts: Partial<Record<PartName, Part>> = {};
  let part: Part | undefined;
  doc.forEach((block, offset) => {
    if (block.type.name === "heading") {
      const name = NAMES[block.textContent.trim().toLowerCase()];
      part = name && !parts[name] ? (parts[name] = { pos: offset + 1, text: "" }) : undefined;
      return;
    }
    const text = block.textContent.trim();
    const colon = text.indexOf(":");
    const label = text.slice(0, colon).trim().toLowerCase();
    if (colon >= 0 && NAMES[label] === "keywords" && !parts.keywords) {
      parts.keywords = { pos: offset + 1, text: text.slice(colon + 1).trim() };
    } else if (part && text) {
      part.text += ` ${text}`;
    }
  });
  return parts;
}

export function readRehearsal(doc: Node, enabledChecks: readonly string[] | null) {
  const docModel = readReviewDoc(doc);
  const parts = partsOf(doc);
  return {
    words: countTextWords(doc.textBetween(0, doc.content.size, " ", " ")),
    abstract: parts.abstract,
    summary: parts.summary,
    keywords: parts.keywords,
    places: reviewPlaces(doc),
    advice: runChecks(docModel, enabledChecks).filter((finding) => finding.severity === "advisory"),
  };
}
