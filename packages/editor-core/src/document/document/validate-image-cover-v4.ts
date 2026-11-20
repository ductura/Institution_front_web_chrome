/**
 * The image (contract v4 §5.2) and the cover (§7) of document v4, for
 * `validateDocumentV4`. The caller checks the block's keys and id; these
 * check the fields. Nothing is repaired, and a valid value is copied from
 * known fields only.
 */

import { isPlainObject } from "../json";
import {
  isSourceId,
  type CoverV4,
  type ImageCrop,
  type ImageNode,
  type NodeId,
} from "./schema";
import { checkUnknownFields } from "./validate-sources";
import { figureTexts, flag, isInteger, tidy, type Raw } from "./validate-table-v4";
import type { ValidationError } from "./validate";

export const IMAGE_FIELDS = new Set([
  "type",
  "id",
  "attachmentId",
  "attachmentSha256",
  "crop",
  "widthPercent",
  "align",
  "landscape",
  "title",
  "source",
]);
export const COVER_FIELDS = new Set(["study", "place", "date"]);
const CROP_FIELDS = new Set(["left", "right", "top", "bottom"]);
const SHA256 = /^[0-9a-f]{64}$/;
const ALIGNMENTS = ["left", "center", "right"] as const;

export const MAX_CROP_PERCENT = 45;
export const MIN_IMAGE_WIDTH_PERCENT = 20;
export const MAX_COVER_STUDY_CODE_POINTS = 200;
export const MAX_COVER_PLACE_CODE_POINTS = 100;
export const MAX_COVER_DATE_CODE_POINTS = 50;

/** §5.2. The attachment is both fields or neither; a crop needs the attachment. */
export function validateImage(
  raw: Raw,
  path: string,
  id: NodeId | null,
  errors: ValidationError[],
): ImageNode | null {
  const before = errors.length;
  const hasId = Object.hasOwn(raw, "attachmentId");
  const hasSha = Object.hasOwn(raw, "attachmentSha256");
  const attachmentOk =
    hasId === hasSha &&
    (!hasId || (isSourceId(raw.attachmentId) && typeof raw.attachmentSha256 === "string" && SHA256.test(raw.attachmentSha256)));
  if (!attachmentOk) errors.push({ path: `${path}.attachmentId`, code: "IMAGE_ATTACHMENT_INVALID" });
  const crop = Object.hasOwn(raw, "crop") ? validateCrop(raw.crop, `${path}.crop`, hasId && hasSha, errors) : undefined;
  if (!isInteger(raw.widthPercent, MIN_IMAGE_WIDTH_PERCENT, 100)) {
    errors.push({ path: `${path}.widthPercent`, code: "IMAGE_LAYOUT_INVALID" });
  }
  if (!(ALIGNMENTS as readonly unknown[]).includes(raw.align)) {
    errors.push({ path: `${path}.align`, code: "IMAGE_LAYOUT_INVALID" });
  }
  const landscape = flag(raw, "landscape", path, errors);
  const texts = figureTexts(raw, path, errors);
  if (id === null || errors.length > before) return null;
  return {
    type: "image",
    id,
    widthPercent: raw.widthPercent as number,
    align: raw.align as ImageNode["align"],
    landscape,
    ...(hasId ? { attachmentId: raw.attachmentId as string, attachmentSha256: raw.attachmentSha256 as string } : {}),
    ...(crop ? { crop } : {}),
    ...texts,
  };
}

function validateCrop(
  raw: unknown,
  path: string,
  hasAttachment: boolean,
  errors: ValidationError[],
): ImageCrop | undefined {
  if (!isPlainObject(raw) || !hasAttachment) {
    errors.push({ path, code: "IMAGE_CROP_INVALID" });
    return undefined;
  }
  checkUnknownFields(raw, CROP_FIELDS, path, errors);
  const sides = ["left", "right", "top", "bottom"] as const;
  const keys = Object.keys(raw);
  const ok =
    keys.length === sides.length &&
    sides.every((side) => isInteger(raw[side], 0, MAX_CROP_PERCENT)) &&
    sides.some((side) => raw[side] !== 0);
  if (!ok) {
    errors.push({ path, code: "IMAGE_CROP_INVALID" });
    return undefined;
  }
  return { top: raw.top as number, bottom: raw.bottom as number, left: raw.left as number, right: raw.right as number };
}

/** §7. At least one field; each tidy text within its limit. */
export function validateCover(raw: unknown, path: string, errors: ValidationError[]): CoverV4 | undefined {
  if (!isPlainObject(raw) || Object.keys(raw).length === 0) {
    errors.push({ path, code: "COVER_INVALID" });
    return undefined;
  }
  checkUnknownFields(raw, COVER_FIELDS, path, errors);
  const before = errors.length;
  const cover = {
    ...tidy(raw, "study", path, MAX_COVER_STUDY_CODE_POINTS, "COVER_FIELD_INVALID", errors),
    ...tidy(raw, "place", path, MAX_COVER_PLACE_CODE_POINTS, "COVER_FIELD_INVALID", errors),
    ...tidy(raw, "date", path, MAX_COVER_DATE_CODE_POINTS, "COVER_FIELD_INVALID", errors),
  };
  return errors.length > before ? undefined : cover;
}
