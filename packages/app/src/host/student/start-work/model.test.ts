// WEB-1402: what the card does with each answer of the start route. Invented ids only.
import { describe, expect, it } from "vitest";

import type { StartedWork } from "../../../../../../src/client/student-work";
import { stepFor, workFacts } from "./model";
import { startWorkText as t } from "./messages.hr";

const ID = "20000000-0000-4000-8000-000000000001";
const WORK: StartedWork = { assignmentId: ID, workId: "30000000-0000-4000-8000-000000000001", language: "hr", rulesVersion: 3 };

describe("stepFor", () => {
  it("a started work opens the editor of that assignment", () => {
    expect(stepFor({ kind: "zapocet", work: WORK }, ID)).toEqual({ kind: "open", route: `/rad/${ID}`, work: WORK });
  });

  it("404 leads to the no-access screen of WEB-1401 as denied, back to the card", () => {
    expect(stepFor({ kind: "nije-pronaden" }, ID)).toEqual({ kind: "leave", route: "/nema-ovlasti?kind=denied&returnTo=%2Fzadaci" });
  });

  it("401 and 403 keep their kind on the same screen", () => {
    expect(stepFor({ kind: "bez-pristupa", access: "expired" }, ID)).toEqual({ kind: "leave", route: "/nema-ovlasti?kind=expired&returnTo=%2Fzadaci" });
    expect(stepFor({ kind: "bez-pristupa", access: "denied" }, ID)).toEqual({ kind: "leave", route: "/nema-ovlasti?kind=denied&returnTo=%2Fzadaci" });
  });

  it("an unacknowledged notice opens the notice first", () => {
    expect(stepFor({ kind: "prvo-obavijest" }, ID)).toEqual({ kind: "leave", route: `/zadatak/${ID}` });
  });

  it("an unknown answer stays on the card and never claims a started work", () => {
    expect(stepFor({ kind: "nepoznato" }, ID)).toEqual({ kind: "note", text: t.unknown });
  });
});

describe("workFacts", () => {
  it("names the language of the work and the version of the faculty rules", () => {
    expect(workFacts(WORK)).toEqual(["Jezik rada: hrvatski", "Pravila fakulteta: verzija 3"]);
    expect(workFacts({ ...WORK, language: "en", rulesVersion: 12 })).toEqual(["Jezik rada: engleski", "Pravila fakulteta: verzija 12"]);
  });

  it("says nothing about the rules while the faculty has none for the work", () => {
    expect(workFacts({ ...WORK, rulesVersion: null })).toEqual(["Jezik rada: hrvatski"]);
  });
});
