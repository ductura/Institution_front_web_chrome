import type { Node } from "@tiptap/pm/model";

import { createApi, type ApiOptions } from "@/client/api";
import type { Read } from "@/client/submission";
import { wordsHr } from "@/lib/i18n/hr";
import { countTextWords, groupHr, wordRangeHr, type WordRange } from "@/lib/i18n/length-line";

import { reviewPlaces } from "../citations/review-places";
import { runChecks } from "../review/checks";
import { readReviewDoc } from "../review/model";
import { rehearsalMessagesHr as t } from "./messages.hr";

type RequirementsRead = Read<{ kind: "ready"; wordRange: WordRange | null }>;
export type Requirements = RequirementsRead | null;

/** SRV-22 permits an open end of the range. Keep the two bounds as the server sent them. */
export async function loadRequirements(assignmentId: string, options?: ApiOptions): Promise<RequirementsRead> {
  try {
    const answer = await createApi(options)("student.assignment-requirements.get", {
      params: { assignmentId }, query: undefined, body: undefined,
    });
    if (answer.status === 401) return { kind: "session-expired" };
    if (!answer.ok || answer.status !== 200) return { kind: "nepoznato" };
    const { wordRange } = answer.body;
    if (wordRange?.min != null && wordRange.max != null && wordRange.min > wordRange.max) return { kind: "nepoznato" };
    return { kind: "ready", wordRange };
  } catch {
    return { kind: "nepoznato" };
  }
}

export function wordsLabel(count: number) {
  return wordsHr(count).replace(String(count), groupHr(count));
}

export function rangeDetail(words: number, requirements: Requirements) {
  if (requirements === null) return t.rangeLoading;
  if (requirements.kind !== "ready") return t.rangeUnavailable;
  const range = requirements.wordRange;
  const label = wordRangeHr(range);
  if (range === null || label === null) return t.rangeNone;
  const target = t.rangeTarget.replace("{range}", label);
  if (range.min !== null && words < range.min) return `${target} ${t.missingWords.replace("{words}", wordsLabel(range.min - words))}`;
  if (range.max !== null && words > range.max) return `${target} ${t.excessWords.replace("{words}", wordsLabel(words - range.max))}`;
  return target;
}

type Part = { pos: number; text: string };
type PartName = "abstract" | "summary" | "keywords";
const NAMES = new Map<string, PartName>([
  [t.abstract.toLowerCase(), "abstract"], [t.summary.toLowerCase(), "summary"], [t.keywords.toLowerCase(), "keywords"],
]);

/** Named sections of the open editor document, including an inline keyword label in the abstract. */
function partsOf(doc: Node) {
  const parts: Partial<Record<PartName, Part>> = {};
  let part: Part | undefined;
  doc.forEach((block, offset) => {
    if (block.type.name === "heading") {
      const name = NAMES.get(block.textContent.trim().toLowerCase());
      part = name && !parts[name] ? (parts[name] = { pos: offset + 1, text: "" }) : undefined;
      return;
    }
    const text = block.textContent.trim();
    const colon = text.indexOf(":");
    const label = text.slice(0, colon).trim().toLowerCase();
    if (colon >= 0 && NAMES.get(label) === "keywords") {
      parts.keywords ??= { pos: offset + 1, text: text.slice(colon + 1).trim() };
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
