/** "Skeniraj crtični kod" (sources2.js): BarcodeDetector ean_13 on a photo of the back of a book. */
import { parseIdentifier } from "@/components/editor/sources/quick-source/identifier";

export type ScanResult = { kind: "isbn"; isbn: string } | { kind: "unsupported" | "none" | "failed" };

type Detector = { detect(image: ImageBitmapSource): Promise<{ rawValue: string }[]> };
type DetectorCtor = new (options: { formats: string[] }) => Detector;

declare global {
  /** Only some browsers have it; read as a property so a missing one is undefined, not a ReferenceError. */
  var BarcodeDetector: DetectorCtor | undefined;
}

export async function scanBarcode(file: Blob, ctor: DetectorCtor | undefined = globalThis.BarcodeDetector,
  decode: (blob: Blob) => Promise<ImageBitmapSource> = (b) => createImageBitmap(b)): Promise<ScanResult> {
  if (!ctor) return { kind: "unsupported" };
  try {
    const found = await new ctor({ formats: ["ean_13"] }).detect(await decode(file));
    if (found.length === 0) return { kind: "none" };
    for (const { rawValue } of found) {
      const id = parseIdentifier(rawValue);
      if (id?.kind === "isbn") return { kind: "isbn", isbn: id.value };
    }
    return { kind: "failed" };
  } catch { return { kind: "failed" }; }
}
