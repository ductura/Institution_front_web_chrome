import { describe, expect, it } from "vitest";

import { fakeDirectEditPort } from "../../student/direct-edit-setting/fake-port";
import { TEACHER_EDIT_WRITABLE, teacherEditPort } from "./port";

describe("teacherEditPort (PM2-R04)", () => {
  it("never writes: the server has no route for the teacher's text", async () => {
    expect(TEACHER_EDIT_WRITABLE).toBe(false);
    expect(await teacherEditPort().submitEdit("doc-demo-1", "Izmišljen tekst.")).toEqual({ kind: "rejected" });
  });
  it("is a DirectEditPort, so the fake stands in for it in the tests", () => {
    expect(Object.keys(teacherEditPort()).sort()).toEqual(["read", "submitEdit", "write"]);
    expect(typeof fakeDirectEditPort().read).toBe("function");
  });
});
