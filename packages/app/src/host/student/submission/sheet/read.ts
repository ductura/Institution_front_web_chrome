// WEB-V14-SHEET-SUBMIT: the read behind the student's sheet summary, only through the generated client
// (evidence.open.post). A work that is not a spreadsheet is "other" (the text/slides pages say their own);
// a failed read is "unavailable", never "other" and never an empty sheet.
import { createApi } from "../../../../../../../src/client/api.ts";
import { summaryOfDocument, type SheetSummary } from "./model.ts";

type Call = ReturnType<typeof createApi>;

export type SheetWorkRead =
  | { readonly kind: "sheet"; readonly revision: number; readonly summary: SheetSummary }
  | { readonly kind: "other" | "empty" | "signIn" | "unavailable" };

export async function readSheetWork(assignmentId: string, call: Call = createApi({ protocol: "1" }), expectedRevision?: number): Promise<SheetWorkRead> {
  try {
    const result = await call("evidence.open.post", { params: undefined, query: undefined, body: { assignmentId } });
    if (!result.ok) return { kind: result.status === 401 ? "signIn" : "unavailable" };
    const work = result.body;
    if (work.workKind !== "spreadsheet") return { kind: "other" };
    if (work.currentRevision === 0) return { kind: "empty" };
    // A receipt names one revision; another one is not what was submitted.
    if (expectedRevision !== undefined && work.currentRevision !== expectedRevision) return { kind: "unavailable" };
    const summary = summaryOfDocument(work.document);
    return summary === null ? { kind: "unavailable" } : { kind: "sheet", revision: work.currentRevision, summary };
  } catch {
    return { kind: "unavailable" };
  }
}
