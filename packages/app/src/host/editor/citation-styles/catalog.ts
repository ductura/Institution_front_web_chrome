// WEB-V20-STIL-ODABIR: the citation styles this build can format with, keyed by the ids of the server catalogue
// (citation.style). `fusnote` (footnote system) has no style file, so it and any unknown id give null.
import { parseCitationStyle, type CitationStyle } from "../../../../../editor-core/src/document/citation/index.ts";
import apaFile from "../../../../../../config/citation-styles/apa.json";
import chicagoFile from "../../../../../../config/citation-styles/chicago.json";
import ieeeFile from "../../../../../../config/citation-styles/ieee.json";
import vancouverFile from "../../../../../../config/citation-styles/vancouver.json";
import fpzgFile from "../../../../../../config/faculties/fpzg/citation.json";
import { citationStyleText } from "./messages.hr";

export const STYLE_IDS = ["fpzg", "apa", "chicago", "ieee", "vancouver"] as const;
export type StyleId = (typeof STYLE_IDS)[number];

/** Every id the server may send, including the one without a style here. */
export const SERVER_STYLE_IDS = [...STYLE_IDS, "fusnote"] as const;

export const DEFAULT_STYLE_ID: StyleId = "fpzg";

const STYLES: Readonly<Record<StyleId, CitationStyle>> = Object.freeze({
  fpzg: parseCitationStyle(fpzgFile),
  apa: parseCitationStyle(apaFile),
  chicago: parseCitationStyle(chicagoFile),
  ieee: parseCitationStyle(ieeeFile),
  vancouver: parseCitationStyle(vancouverFile),
});

export const isStyleId = (id: unknown): id is StyleId =>
  typeof id === "string" && Object.prototype.hasOwnProperty.call(STYLES, id);

/** The style of `id`, or null for `fusnote` and for anything that is not an id of this catalogue. */
export function citationStyleOf(id: unknown): CitationStyle | null {
  return isStyleId(id) ? STYLES[id] : null;
}

export const styleNameOf = (id: StyleId): string => citationStyleText.names[id];
