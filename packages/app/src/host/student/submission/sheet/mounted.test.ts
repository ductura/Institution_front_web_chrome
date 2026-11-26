// WEB-V14-SHEET-SUBMIT: the new components are mounted where the task puts them, not only used in their tests.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("sheet submission mounting", () => {
  it("the student's step before submitting and the receipt show the sheet summary", () => {
    expect(source("../summary/BeforeSubmitStep.tsx")).toContain("<SheetSummary assignmentId={assignmentId}");
    expect(source("../receipt/SubmittedReceipt.tsx")).toContain("<SheetSummary assignmentId={assignmentId}");
  });
  it("the teacher's work page branches to the read-only sheet", () => {
    expect(source("../../../teacher/work/pages.tsx")).toContain("<SheetOrWork ");
  });
});
