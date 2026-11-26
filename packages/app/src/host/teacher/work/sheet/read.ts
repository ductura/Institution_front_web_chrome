// WEB-V14-SHEET-SUBMIT: the teacher's reads of a spreadsheet work, only through the generated client:
// work.versions.get (newest revision) and work.version.get (its canonical document and `workKind`). Nothing is
// written. Somebody else's work is 404 on the server and "notFound" here, never an empty sheet or a text work.
import { createApi } from "../../../../../../../src/client/api.ts";
import { canonicalSheetDocument, validateSheetDocument, type SheetDocument } from "../../../../../../editor-core/src/sheet/index.ts";

type Call = ReturnType<typeof createApi>;

export type SheetRead =
  | { readonly kind: "sheet"; readonly revision: number; readonly document: SheetDocument }
  | { readonly kind: "text" | "signedOut" | "notFound" | "unavailable" | "invalid" };

const failure = (status: number): SheetRead => ({ kind: status === 401 ? "signedOut" : status === 404 ? "notFound" : "unavailable" });

export async function readSheetReview(documentId: string, call: Call = createApi()): Promise<SheetRead> {
  try {
    const list = await call("work.versions.get", { params: { documentId }, query: {}, body: undefined });
    if (!list.ok) return failure(list.status);
    const newest = list.body.versions.reduce<number | null>((max, v) => (max === null || v.revision > max ? v.revision : max), null);
    if (newest === null) return { kind: "text" };
    const one = await call("work.version.get", { params: { documentId, revision: String(newest) }, query: {}, body: undefined });
    if (!one.ok) return failure(one.status);
    if (!("document" in one.body)) return { kind: "unavailable" };
    if (one.body.workKind !== "spreadsheet") return { kind: "text" };
    if (one.body.revision !== newest) return { kind: "unavailable" };
    const checked = validateSheetDocument(JSON.parse(one.body.document));
    // Only the exact canonical bytes of a valid sheet are shown.
    return checked.ok && canonicalSheetDocument(checked.value) === one.body.document
      ? { kind: "sheet", revision: newest, document: checked.value } : { kind: "invalid" };
  } catch {
    return { kind: "unavailable" };
  }
}
