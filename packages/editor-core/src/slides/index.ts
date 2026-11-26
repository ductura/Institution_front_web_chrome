// Public interface of the slides model (WEB-V13-MODEL-KLIJENT), exported as
// `@ductura/editor-core/slides`. Mirror of server/domain/slides.
export * from "./model";
export { isSlideText, validateSlidesDocument, type SlidesValidation } from "./validate";
export {
  readDocumentKind,
  sha256Hex,
  slidesDocumentsEqual,
  slidesSnapshotBytes,
  slidesSnapshotSha256,
  slidesSnapshotText,
  verifySlidesSnapshot,
  type DocumentKindReading,
  type SlidesSnapshotVerification,
} from "./json";
export * from "./steps";
