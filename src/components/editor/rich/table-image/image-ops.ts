/** Pure image edits behind the image bar and the crop dialog (E§3.3, E§3.6 rich; document v4 §5.2). */

import type { ImageCrop } from "@/domain/document/schema";

export const MIN_WIDTH_PERCENT = 20;
export const MAX_WIDTH_PERCENT = 100;
export const MAX_CROP_PERCENT = 45;
export const WIDTH_STEP = 10;

export type Align = "left" | "center" | "right";
export type ImageState = {
  widthPercent: number;
  align: Align;
  landscape: boolean;
  attachmentId?: string;
  attachmentSha256?: string;
  crop?: ImageCrop;
};

export const NO_CROP: ImageCrop = { top: 0, left: 0, right: 0, bottom: 0 };

export const clampWidth = (percent: number): number =>
  Math.max(MIN_WIDTH_PERCENT, Math.min(MAX_WIDTH_PERCENT, Math.round(Number.isFinite(percent) ? percent : MAX_WIDTH_PERCENT)));

export const setWidth = (i: ImageState, percent: number): ImageState => ({ ...i, widthPercent: clampWidth(percent) });
export const stepWidth = (i: ImageState, direction: 1 | -1): ImageState => setWidth(i, i.widthPercent + direction * WIDTH_STEP);
export const setAlign = (i: ImageState, align: Align): ImageState => ({ ...i, align });
export const setImageLandscape = (i: ImageState, landscape: boolean): ImageState => ({ ...i, landscape });

const SIDES = ["left", "right", "top", "bottom"] as const;
export const clampSide = (value: number): number =>
  Math.max(0, Math.min(MAX_CROP_PERCENT, Math.round(Number.isFinite(value) ? value : 0)));

/** A crop the contract accepts: four integers 0 to 45, at least one above zero, and the picture kept in both directions. */
export function normalizeCrop(raw: ImageCrop): ImageCrop | null {
  const crop = { top: clampSide(raw.top), left: clampSide(raw.left), right: clampSide(raw.right), bottom: clampSide(raw.bottom) };
  return SIDES.some((side) => crop[side] !== 0) ? crop : null;
}

/** Sets the crop; an all-zero crop removes it. The cropped picture is never saved: the attachment stays whole. */
export function setCrop(i: ImageState, crop: ImageCrop): ImageState {
  const { crop: _old, ...rest } = i;
  const next = i.attachmentId ? normalizeCrop(crop) : null;
  return next ? { ...rest, crop: next } : rest;
}
export const clearCrop = (i: ImageState): ImageState => setCrop(i, NO_CROP);

/** Side of the picture kept, in percent of the whole (what the preview frame covers). */
export const keptPercent = (crop: ImageCrop): { width: number; height: number } => ({
  width: 100 - crop.left - crop.right,
  height: 100 - crop.top - crop.bottom,
});

/** CSS `inset` of the kept area over the whole picture, as in the prototype's dialog. */
export const cropInset = (crop: ImageCrop): string => `${crop.top}% ${crop.right}% ${crop.bottom}% ${crop.left}%`;

/** CSS `clip-path` that shows only the kept area. */
export const cropClip = (crop: ImageCrop): string => `inset(${cropInset(crop)})`;
