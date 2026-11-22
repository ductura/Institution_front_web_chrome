import { expect, it } from "vitest";
import { scanBarcode } from "./barcode";

const blob = new Blob(["x"]);
const decode = async () => ({}) as ImageBitmapSource;
const detector = (values: string[] | Error) => class { async detect() { if (values instanceof Error) throw values; return values.map((rawValue) => ({ rawValue })); } };

it("reads an ISBN, or explains why not", async () => {
  expect(await scanBarcode(blob, undefined, decode)).toEqual({ kind: "unsupported" });
  expect(await scanBarcode(blob, detector(["9780306406157"]), decode)).toEqual({ kind: "isbn", isbn: "9780306406157" });
  expect(await scanBarcode(blob, detector([]), decode)).toEqual({ kind: "none" });
  expect(await scanBarcode(blob, detector(["1234567890123"]), decode)).toEqual({ kind: "failed" });
  expect(await scanBarcode(blob, detector(new Error("x")), decode)).toEqual({ kind: "failed" });
});
