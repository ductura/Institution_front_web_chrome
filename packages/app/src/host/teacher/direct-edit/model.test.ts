import { describe, expect, it } from "vitest";

import { changeDirectEdit, directEditBadge, type DirectEditPort } from "../../student/direct-edit-setting/model";
import { fakeDirectEditPort } from "../../student/direct-edit-setting/fake-port";
import {
  accessAfter, accessFrom, segmentMark, submitTeacherEdit, type TeacherEditPort, type TeacherEditResult,
} from "./model";

const ID = "3c9f0a1e-7b2d-4e5f-8a6b-1c2d3e4f5a60";

/** One shared state for both roles, as the server holds it; the write refuses once the setting is off. */
function sharedPort(): TeacherEditPort & { readonly texts: string[] } {
  const base = fakeDirectEditPort(false);
  const texts: string[] = [];
  return {
    texts,
    read: (id) => base.read(id),
    write: (id, enabled) => base.write(id, enabled),
    async submitEdit(id, body): Promise<TeacherEditResult> {
      const read = await base.read(id);
      if (read.kind !== "ready" || !read.state.enabled) return { kind: "revoked" };
      texts.push(body);
      return { kind: "saved", text: body };
    },
  };
}

describe("direct edits: enable, edit, revoke (WEB-1703)", () => {
  it("locks while off, opens when the student allows, and a revocation locks the teacher at once", async () => {
    const port = sharedPort();
    expect(accessFrom(await port.read(ID))).toEqual({ kind: "locked", reason: "off" });
    expect(await submitTeacherEdit(port, ID, { kind: "locked", reason: "off" }, "Tekst")).toEqual({ kind: "rejected" });
    expect(port.texts).toEqual([]);

    expect((await changeDirectEdit(port, ID, true)).kind).toBe("recorded");
    const open = accessFrom(await port.read(ID));
    expect(open).toEqual({ kind: "open" });
    expect(await submitTeacherEdit(port, ID, open, "Izmišljena izmjena")).toEqual({ kind: "saved", text: "Izmišljena izmjena" });

    // The student revokes while the teacher's field is still open on screen.
    expect((await changeDirectEdit(port, ID, false)).kind).toBe("recorded");
    const refused = await submitTeacherEdit(port, ID, open, "Zakašnjela izmjena");
    expect(refused).toEqual({ kind: "revoked" });
    expect(accessAfter(open, refused)).toEqual({ kind: "locked", reason: "revoked" });
    expect(port.texts).toEqual(["Izmišljena izmjena"]);
  });

  it("shows the same mark to both roles", () => {
    expect(directEditBadge(true)).not.toBe(directEditBadge(false));
    expect(directEditBadge(true)).toBe("Izravne izmjene nastavnika dopuštene");
  });

  it("marks only the teacher's text", () => {
    expect(segmentMark({ author: "teacher", text: "x" })).toBe("Nastavnikov tekst");
    expect(segmentMark({ author: "student", text: "x" })).toBeNull();
  });

  it("locks on every doubt", async () => {
    expect(accessFrom({ kind: "unavailable" })).toEqual({ kind: "locked", reason: "unavailable" });
    expect(accessFrom({ kind: "signedOut" })).toEqual({ kind: "locked", reason: "signedOut" });
    const port = sharedPort();
    await changeDirectEdit(port, ID, true);
    const lying: TeacherEditPort = { ...port, submitEdit: async () => ({ kind: "saved", text: "drugi tekst" }) };
    expect(await submitTeacherEdit(lying, ID, { kind: "open" }, "moj tekst")).toEqual({ kind: "unknown" });
    const broken: TeacherEditPort = { ...port, submitEdit: async () => { throw new Error("mreža"); } };
    expect(await submitTeacherEdit(broken, ID, { kind: "open" }, "tekst")).toEqual({ kind: "unknown" });
  });

  it("does not call a change recorded when the answer names the other state", async () => {
    const port: DirectEditPort = {
      read: async () => ({ kind: "unavailable" }),
      write: async () => ({ kind: "recorded", state: { enabled: false, changedAt: null } }),
    };
    expect(await changeDirectEdit(port, ID, true)).toEqual({ kind: "unknown" });
  });
});
