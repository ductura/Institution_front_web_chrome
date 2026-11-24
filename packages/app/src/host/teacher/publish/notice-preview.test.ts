import { describe, expect, it } from "vitest";

import { AI_PURPOSES } from "@/components/teacher/assignment-create";
import { messagesHr } from "@/lib/i18n/messages.hr";

import { allowedPurposes, noticeLines, wordsText } from "./notice-preview";

const NBSP = "\u00a0";
const labels = messagesHr.facultyRuleVersions.purposeLabels;
const base = { versionNo: 2, dueAt: "2026-11-08T22:59:00.000Z", aiPolicy: "partially_allowed", aiPurposes: ["proofreading"], importAllowed: false, wordMin: 800, wordMax: 1200 } as const;

/** The student notice keeps a purpose when the closed list has it and the version lists it (HostNotice.tsx ToolsCard). */
const studentAllowed = (purposes: readonly string[]) => AI_PURPOSES.filter((p) => purposes.includes(p));

describe("notice preview (NZ-7a)", () => {
  it("lists the fields in a fixed order, deadline in Zagreb time", () => {
    const l = noticeLines(base);
    expect(l.map((x) => x.label)).toEqual(["Rok", "Alati", "Opseg", "Uvoz teksta", "Verzija obavijesti"]);
    expect(l[0]!.value).toBe("8. 11. 2026. u 23:59");
    expect(l[1]!.value).toBe("Asistent je dopušten za: lektoriranje i jezična provjera");
    expect(l[2]!.value).toBe(`800–1${NBSP}200 riječi`);
    expect(l[3]!.value).toBe("nije dopušten");
    expect(l[4]!.value).toBe("2");
  });

  it.each(AI_PURPOSES)("a version allowing only %s shows it as allowed, with the catalogue label", (purpose) => {
    expect(noticeLines({ ...base, aiPurposes: [purpose] })[1]!.value).toBe(`Asistent je dopušten za: ${labels[purpose]}`);
  });

  it("all five purposes, in the order of the article, whatever order the version lists them", () => {
    const reversed = [...AI_PURPOSES].reverse();
    expect(noticeLines({ ...base, aiPurposes: reversed })[1]!.value).toBe(
      "Asistent je dopušten za: formatiranje, lektoriranje i jezična provjera, pronalaženje literature, transkribiranje, prevođenje",
    );
  });

  it("allows exactly the purposes the student notice allows, for every subset of the five", () => {
    for (let mask = 0; mask < 1 << AI_PURPOSES.length; mask += 1) {
      const subset = AI_PURPOSES.filter((_, i) => mask & (1 << i));
      expect(allowedPurposes(subset)).toEqual(studentAllowed(subset).map((p) => labels[p]));
    }
  });

  it("says no assistant when the version allows none, and never shows a key outside the closed list", () => {
    expect(noticeLines({ ...base, aiPolicy: "prohibited", aiPurposes: [] })[1]!.value).toBe("Asistent nije dopušten");
    expect(noticeLines({ ...base, aiPurposes: ["summarising", "idea_generation"] })[1]!.value).toBe("Asistent nije dopušten");
    expect(noticeLines({ ...base, aiPurposes: ["summarising", "translation"] })[1]!.value).toBe("Asistent je dopušten za: prevođenje");
  });

  it("words: grouped thousands as in the student notice, open ends in words", () => {
    expect(wordsText(2000, 2500)).toBe(`2${NBSP}000–2${NBSP}500 riječi`);
    expect(wordsText(null, null)).toBe("bez ograničenja");
    expect(wordsText(500, null)).toBe("najmanje 500 riječi");
    expect(wordsText(null, 12500)).toBe(`najviše 12${NBSP}500 riječi`);
    expect(noticeLines({ ...base, importAllowed: true })[3]!.value).toBe("dopušten");
  });

  it("names no AI provider or model and uses no forbidden term", () => {
    const all = JSON.stringify(noticeLines({ ...base, aiPurposes: [...AI_PURPOSES] }));
    expect(all).not.toMatch(/plagijat|varanje|sumnjiv|provjera AI|openai|gpt|claude|gemini/i);
  });
});
