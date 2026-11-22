import { describe, expect, it } from "vitest";

import { messagesHr } from "../../../../../../locales/hr.ts";
import { navFor } from "../../../../../../src/components/index.ts";
import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";

import { teacherShellHr } from "./messages.hr";
import { shellMessagesFor } from "./messages";

describe("teacher shell texts (WEB-2141)", () => {
  it("name the summary 'Zbirni' and the drawer button 'Izbornik' for the teacher only", () => {
    const teacher = shellMessagesFor(messagesHr, "teacher");
    expect(navFor("teacher", teacher).map((i) => i.label)).toEqual(["Moji kolegiji", "Brz put", "Radovi uz mentora", "Zbirni"]);
    expect(teacher.shell.openNav).toBe("Izbornik");
    expect(teacher.shell.closeNav).toBe("Izbornik");
    expect(shellMessagesFor(messagesHr, "student")).toBe(messagesHr);
    expect(shellMessagesFor(messagesHr, null)).toBe(messagesHr);
  });

  it("hold no forbidden term (Ductus PRODUCT §5)", () => {
    for (const value of Object.values(teacherShellHr)) expect(findForbiddenTerms(value, "hr")).toEqual([]);
  });
});
