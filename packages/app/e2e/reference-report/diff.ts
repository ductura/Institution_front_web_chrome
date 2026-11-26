// DAN-1565: pixel difference of two PNG images, computed in the browser's
// canvas so the tool needs no image library. Not the catalogue's comparison:
// it changes no baseline and has no threshold of its own.
import type { Page } from "@playwright/test";

export type ImageDiff = {
  /** Share of differing pixels of the larger of the two areas, 0 to 100. */
  readonly percent: number;
  readonly sameSize: boolean;
  /** PNG, base64: differing pixels in one colour over a faded reference. */
  readonly diffBase64: string;
};

/** A channel difference below this is the same pixel (antialiasing, font rendering). */
export const CHANNEL_TOLERANCE = 16;

/**
 * Compares `reference` and `actual` (PNG, base64) from the top left corner.
 * A pixel that exists in only one of them differs. Runs on `page`, which must
 * be on a document that may draw data URLs to a canvas (any http page).
 */
export async function diffImages(page: Page, reference: string, actual: string): Promise<ImageDiff> {
  return page.evaluate(async ({ reference, actual, tolerance }) => {
    const load = async (base64: string) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      return image;
    };
    const [a, b] = [await load(reference), await load(actual)];
    const width = Math.max(a.naturalWidth, b.naturalWidth);
    const height = Math.max(a.naturalHeight, b.naturalHeight);
    const pixelsOf = (image: HTMLImageElement) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true })!;
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, width, height).data;
    };
    const [pa, pb] = [pixelsOf(a), pixelsOf(b)];
    const out = document.createElement("canvas");
    out.width = width;
    out.height = height;
    const context = out.getContext("2d")!;
    const result = context.createImageData(width, height);
    let differing = 0;
    for (let i = 0; i < pa.length; i += 4) {
      const x = (i / 4) % width;
      const y = Math.floor(i / 4 / width);
      const inBoth = x < a.naturalWidth && y < a.naturalHeight && x < b.naturalWidth && y < b.naturalHeight;
      let differs = !inBoth;
      for (let c = 0; c < 4 && !differs; c++) differs = Math.abs(pa[i + c]! - pb[i + c]!) > tolerance;
      if (differs) {
        differing += 1;
        result.data.set([200, 30, 90, 255], i);
      } else {
        // The matching pixel, faded towards white, so the place can be found.
        const grey = (pa[i]! + pa[i + 1]! + pa[i + 2]!) / 3;
        const faded = 255 - (255 - grey) / 4;
        result.data.set([faded, faded, faded, 255], i);
      }
    }
    context.putImageData(result, 0, 0);
    return {
      percent: (differing / (width * height)) * 100,
      sameSize: a.naturalWidth === b.naturalWidth && a.naturalHeight === b.naturalHeight,
      diffBase64: out.toDataURL("image/png").split(",")[1]!,
    };
  }, { reference, actual, tolerance: CHANNEL_TOLERANCE });
}
