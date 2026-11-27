import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// WEB-V17-RUBRIC-STUDENT: the card is used by the student's work page (not only by a test), once, and not in
// the step before submission, which another task holds.
describe("the rubric card is mounted", () => {
  it("WorkEditorPage.tsx mounts RubricCard in the instructions section with the assignment id", () => {
    const source = readFileSync(join(import.meta.dirname, "../WorkEditorPage.tsx"), "utf8");
    expect(source).toContain('from "./rubric/RubricCard"');
    expect(source.match(/<RubricCard assignmentId=\{assignmentId\}/g)).toHaveLength(1);
  });
});
