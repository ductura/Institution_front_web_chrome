/**
 * Numbered headings and the table of contents (WEB-1602, plan M5.3, DAN-395):
 * the one entry for every consumer of chapter numbers. The projection itself is
 * `deriveChapters` (document/document/chapters.ts); M5.8, M5.14, M4.4 and the
 * export read it through here or directly, never a second numbering.
 */
export {
  deriveChapters,
  NEUTRAL_CHAPTER_PROFILE,
  type Chapter,
  type ChapterOutline,
  type ChapterProfile,
} from "../document/document";
export { blockPosition, ChapterNumbers, numberedHeadings, type NumberedHeading } from "../editor/chapter-numbers";
export * from "./toc";
export * from "./move";
export * from "./editor";
