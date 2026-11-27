// WEB-DATUM-TOCKA: no "2026.." after a Croatian date, on its own or inside a sentence (Ductus#2059 c.7213580738).
import { describe, expect, it } from "vitest";

import { facultySettingsMessages as fs } from "../host/admin/faculty-settings/messages.hr";
import { stateView } from "../host/editor/mentor/mentor-model";
import { oneDot } from "./date-dot";

const long = (iso: string) => new Intl.DateTimeFormat("hr-HR", { dateStyle: "long" }).format(new Date(iso));
const medium = (iso: string) => new Intl.DateTimeFormat("hr-HR", { dateStyle: "medium", timeZone: "Europe/Zagreb" }).format(new Date(iso));
const DOUBLE = /\d{4}\.\./;

describe("oneDot", () => {
  it("keeps the year's dot as the full stop at the end and inside a sentence", () => {
    expect(oneDot("Suglasnost za predaju dana 27. studenoga 2026..")).toBe("Suglasnost za predaju dana 27. studenoga 2026.");
    expect(oneDot("Zadnja promjena: 27. stu 2026.. Objavio: Izmišljena Osoba.")).toBe("Zadnja promjena: 27. stu 2026. Objavio: Izmišljena Osoba.");
    expect(oneDot("27. 11. 2026..")).toBe("27. 11. 2026.");
  });

  it("leaves text without a doubled dot, an ellipsis and times as written", () => {
    for (const text of ["Rok: 10. 12. 2026. u 10:00.", "Učitavanje…", "Spremam...", "verzija 2026", "27. 11. 2026."]) {
      expect(oneDot(text)).toBe(text);
    }
  });
});

describe("dates in sentences", () => {
  it("the Mentor card's consent line has one dot after the year", () => {
    const at = "2026-11-27T10:00:00";
    const view = stateView("student", { kind: "accepted", consentAt: at }, new Date("2026-11-28T10:00:00"));
    expect(long(at).endsWith(".")).toBe(true);
    expect(view.sub).toBe(`Suglasnost za predaju dana ${long(at)}`);
    expect(view.sub).not.toMatch(DOUBLE);
  });

  it("Postavke fakulteta say the last change with one dot, alone and before the next sentence", () => {
    const date = medium("2026-11-27T10:00:00Z");
    expect(date.endsWith(".")).toBe(true);
    expect(fs.thesisSettings.changed(date)).toBe(`Zadnja promjena: ${date}`);
    expect(fs.rules.changed(date, "Izmišljena Osoba")).toBe(`Zadnja promjena: ${date} Objavio: Izmišljena Osoba.`);
    expect(fs.forms.published(date)).toBe(`objavljen ${date}`);
    for (const line of [fs.thesisSettings.changed(date), fs.rules.changed(date, "Izmišljena Osoba"), fs.forms.published(date)]) expect(line).not.toMatch(DOUBLE);
  });
});
