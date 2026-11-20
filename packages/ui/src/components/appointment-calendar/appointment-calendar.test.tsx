import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AppointmentCalendar, type AppointmentCalendarLabels } from "./AppointmentCalendar";
import { clampDay, dayMark, formatMoment, gridKeyTarget, openingFocus, parseMoment, roundTrip, selectDay, slotMark, type Appointment } from "./appointment-logic";

const labels: AppointmentCalendarLabels = {
  calendar: "Kalendar termina", previousMonth: "Prethodni mjesec", nextMonth: "Sljedeći mjesec",
  months: ["siječanj", "veljača", "ožujak", "travanj", "svibanj", "lipanj", "srpanj", "kolovoz", "rujan", "listopad", "studeni", "prosinac"],
  weekdays: ["pon", "uto", "sri", "čet", "pet", "sub", "ned"], times: "Vrijeme", proposed: "predloženo", confirmed: "potvrđeno",
  chooseDay: "Odaberite dan", selected: (d, t) => `Odabrano: ${d} u ${t}`,
};
const apps: Appointment[] = [
  { id: "a", at: "2026-11-20T12:00", status: "proposed" },
  { id: "b", at: "2026-11-20T14:00", status: "confirmed" },
  { id: "c", at: "2026-11-25T09:00", status: "proposed" },
];
const html = (value: string) => renderToStaticMarkup(
  <AppointmentCalendar appointments={apps} value={value} onSelect={() => undefined} labels={labels} today="2026-11-01" />);

describe("appointment moments", () => {
  it("parses and rejects impossible moments", () => {
    expect(parseMoment("2026-11-20T12:00")).toEqual({ date: "2026-11-20", time: "12:00" });
    expect(parseMoment("2026-02-30T12:00")).toBeNull();
    expect(parseMoment("2026-11-20T24:00")).toBeNull();
    expect(parseMoment("2026-11-20")).toBeNull();
  });
  it("gives back the same moment on reopening", () => {
    expect(roundTrip("2026-11-20T12:00")).toBe("2026-11-20T12:00");
    expect(formatMoment(parseMoment("2026-11-20T09:05")!)).toBe("2026-11-20T09:05");
    expect(openingFocus("2026-12-03T10:00", apps, "2026-11-01")).toBe("2026-12-03");
  });
  it("opens on the earliest appointment, then today", () => {
    expect(openingFocus("", apps, "2026-11-01")).toBe("2026-11-20");
    expect(openingFocus("", [], "2026-11-01")).toBe("2026-11-01");
  });
  it("marks confirmed over proposed", () => {
    expect(dayMark("2026-11-20", apps)).toBe("confirmed");
    expect(dayMark("2026-11-25", apps)).toBe("proposed");
    expect(dayMark("2026-11-21", apps)).toBeNull();
    expect(slotMark("2026-11-20", "12:00", apps)).toBe("proposed");
    expect(slotMark("2026-11-20", "13:00", apps)).toBeNull();
  });
  it("needs both day and time, inside the range", () => {
    expect(selectDay("2026-11-20", "")).toBeNull();
    expect(selectDay("2026-11-20", "10:00", "2026-11-21")).toBeNull();
    expect(selectDay("2026-11-20", "10:00")).toEqual({ date: "2026-11-20", time: "10:00" });
  });
  it("moves with the keyboard", () => {
    expect(gridKeyTarget("2026-11-20", "ArrowRight")).toBe("2026-11-21");
    expect(gridKeyTarget("2026-11-20", "PageDown")).toBe("2026-12-20");
    expect(gridKeyTarget("2026-11-20", "x")).toBeNull();
  });
});

describe("focus range", () => {
  it("clamps into min/max", () => {
    expect(clampDay("2026-11-01", "2026-11-10")).toBe("2026-11-10");
    expect(clampDay("2026-12-01", undefined, "2026-11-30")).toBe("2026-11-30");
    expect(clampDay("2026-11-15", "2026-11-10", "2026-11-30")).toBe("2026-11-15");
  });
  it("gives the grid an enabled entry point when today is before min", () => {
    const out = renderToStaticMarkup(<AppointmentCalendar appointments={[]} value="" onSelect={() => undefined} labels={labels} today="2026-11-01" min="2026-11-10" />);
    expect(out).toMatch(/data-day="2026-11-10"[^>]*tabindex="0"|tabindex="0"[^>]*data-day="2026-11-10"/);
  });
});

describe("AppointmentCalendar markup", () => {
  it("opens on the month of the chosen moment with it selected", () => {
    const out = html("2026-11-20T12:00");
    expect(out).toContain("studeni 2026.");
    expect(out).toContain("Odabrano: 20. 11. 2026. u 12:00");
    expect(out).toMatch(/data-time="12:00"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-time="12:00"/);
  });
  it("labels proposed and confirmed appointments in text, not colour only", () => {
    const out = html("2026-11-20T12:00");
    expect(out).toContain("12:00, predloženo");
    expect(out).toContain("14:00, potvrđeno");
    expect(out).toContain("20. 11. 2026., potvrđeno");
  });
  it("keeps times disabled until a day is chosen", () => {
    const out = html("");
    expect(out).toContain("Odaberite dan");
    expect(out).toMatch(/data-time="09:00"[^>]*disabled|disabled[^>]*data-time="09:00"/);
  });
});
