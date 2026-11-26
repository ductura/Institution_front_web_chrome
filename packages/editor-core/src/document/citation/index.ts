export { deriveBibliography, formatCitation, type Bibliography, type BibliographyEntry } from "./bibliography";
export {
  assignYearSuffixes,
  formatBibliographyEntry,
  formatCitationInText,
  formatInText,
  formatNumberedBibliographyEntry,
  formatNumericCitation,
  normalizePages,
  sortBibliography,
} from "./format";
export { deriveFootnoteNotes, FOOTNOTE_LABELS, type FootnoteNote, type FootnoteNoteKind } from "./footnote-notes";
export { CitationStyleError, parseCitationStyle, type CitationStyle } from "./style";
export * from "./types";

// A style comes from the record of an institution (src/domain/institution-config,
// M2.12-P02), never from a default here.
