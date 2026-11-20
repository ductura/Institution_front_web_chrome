/**
 * The cut-out of a proof (E§3.4 proofs): the rectangle the student drags on a
 * page, and how it is encoded. Only the rectangle becomes a JPEG; the rest of
 * the picture or PDF page never leaves this module. As the prototype: a
 * selection under 12 px is no selection, the cut-out is at most 1000 px wide
 * at quality 0.72 and, when that is too large, 800 px at 0.55, on white.
 */

import { PROOF_IMAGE_MAX_BYTES } from "../../../../client/source-proofs";

export type Size = { readonly width: number; readonly height: number };
export type Rect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
export type Point = { readonly x: number; readonly y: number };

/** A smaller drag is a click, not a selection (prototype `min 12 px`). */
export const MIN_SELECTION = 12;
/** A picture is drawn at most this large on its longer side before cutting (prototype 2200 px). */
export const MAX_SOURCE_SIDE = 2200;
export const ENCODE_STEPS = [
  { maxWidth: 1000, quality: 0.72 },
  { maxWidth: 800, quality: 0.55 },
] as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The rectangle between two points of a drag, inside `bounds`; null when smaller than MIN_SELECTION. */
export function dragRect(start: Point, end: Point, bounds: Size): Rect | null {
  const x1 = clamp(Math.min(start.x, end.x), 0, bounds.width);
  const y1 = clamp(Math.min(start.y, end.y), 0, bounds.height);
  const x2 = clamp(Math.max(start.x, end.x), 0, bounds.width);
  const y2 = clamp(Math.max(start.y, end.y), 0, bounds.height);
  const width = x2 - x1;
  const height = y2 - y1;
  return width < MIN_SELECTION || height < MIN_SELECTION ? null : { x: x1, y: y1, width, height };
}

/** The rectangle moved (or grown with `grow`) by a key, kept inside `bounds`. */
export function nudgeRect(rect: Rect, dx: number, dy: number, bounds: Size, grow = false): Rect {
  if (grow) {
    const width = clamp(rect.width + dx, MIN_SELECTION, bounds.width - rect.x);
    const height = clamp(rect.height + dy, MIN_SELECTION, bounds.height - rect.y);
    return { ...rect, width, height };
  }
  return {
    ...rect,
    x: clamp(rect.x + dx, 0, bounds.width - rect.width),
    y: clamp(rect.y + dy, 0, bounds.height - rect.height),
  };
}

/** A rectangle given in the displayed size, in the picture's own pixels. */
export function toSource(rect: Rect, shown: Size, natural: Size): Rect {
  const sx = natural.width / shown.width;
  const sy = natural.height / shown.height;
  const x = clamp(Math.round(rect.x * sx), 0, natural.width - 1);
  const y = clamp(Math.round(rect.y * sy), 0, natural.height - 1);
  return {
    x, y,
    width: clamp(Math.round(rect.width * sx), 1, natural.width - x),
    height: clamp(Math.round(rect.height * sy), 1, natural.height - y),
  };
}

/** The size within `maxSide` on the longer side, never enlarged. */
export function fitSide(size: Size, maxSide: number): Size {
  const scale = Math.min(1, maxSide / Math.max(size.width, size.height));
  return { width: Math.max(1, Math.round(size.width * scale)), height: Math.max(1, Math.round(size.height * scale)) };
}

/** The output size of a cut-out within `maxWidth`, never enlarged. */
export function outputSize(rect: Size, maxWidth: number): Size {
  const scale = Math.min(1, maxWidth / rect.width);
  return { width: Math.max(1, Math.round(rect.width * scale)), height: Math.max(1, Math.round(rect.height * scale)) };
}

/** What can draw a part of a picture onto a 2D context (an ImageBitmap, a canvas, the catalogue's sample). */
export type ProofPicture = Size & {
  readonly draw: (ctx: CanvasRenderingContext2D, from: Rect, to: Rect) => void;
};

export type Encoder = {
  /** A fresh canvas of the given size. */
  readonly canvas: (size: Size) => HTMLCanvasElement;
  readonly toBlob: (canvas: HTMLCanvasElement, quality: number) => Promise<Blob | null>;
};

const browserEncoder: Encoder = {
  canvas: ({ width, height }) => Object.assign(document.createElement("canvas"), { width, height }),
  toBlob: (canvas, quality) => new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality)),
};

/**
 * The JPEG of `rect` of `picture` (the whole picture when rect is null), or
 * null when even the smaller step is over the limit.
 */
export async function encodeCut(picture: ProofPicture, rect: Rect | null, encoder: Encoder = browserEncoder): Promise<Blob | null> {
  const from = rect ?? { x: 0, y: 0, width: picture.width, height: picture.height };
  for (const step of ENCODE_STEPS) {
    const size = outputSize(from, step.maxWidth);
    const canvas = encoder.canvas(size);
    const ctx = canvas.getContext("2d");
    if (ctx === null) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size.width, size.height);
    picture.draw(ctx, from, { x: 0, y: 0, ...size });
    const blob = await encoder.toBlob(canvas, step.quality);
    if (blob !== null && blob.size > 0 && blob.size <= PROOF_IMAGE_MAX_BYTES) return blob;
  }
  return null;
}

/** A picture over an ImageBitmap or canvas the browser decoded. */
export function pictureOf(source: CanvasImageSource & Size): ProofPicture {
  return {
    width: source.width, height: source.height,
    draw: (ctx, from, to) => ctx.drawImage(source, from.x, from.y, from.width, from.height, to.x, to.y, to.width, to.height),
  };
}

/**
 * A picture file or a pasted image, decoded in the browser (never sent) and
 * drawn at most MAX_SOURCE_SIDE on its longer side. Null for anything that is
 * not an image the browser can decode.
 */
export async function pictureFromFile(file: Blob): Promise<ProofPicture | null> {
  if (!file.type.startsWith("image/")) return null;
  try {
    const bitmap = await createImageBitmap(file);
    const size = fitSide(bitmap, MAX_SOURCE_SIDE);
    if (size.width === bitmap.width && size.height === bitmap.height) return pictureOf(bitmap);
    const canvas = browserEncoder.canvas(size);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();
    return pictureOf(canvas);
  } catch {
    return null;
  }
}
