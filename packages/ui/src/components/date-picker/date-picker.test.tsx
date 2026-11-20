import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DatePicker, type DatePickerLabels } from "./DatePicker";
import { addDays, addMonths, formatHrDate, gridKeyTarget, inRange, monthGrid, parseHrDate } from "./date-logic";

const labels: DatePickerLabels = {
  field: "Rok", choose: "Odaberi datum", previousMonth: "Prethodni mjesec", nextMonth: "Sljedeći mjesec", invalid: "Upišite datum kao d. M. gggg.",
  months: ["siječanj", "veljača", "ožujak", "travanj", "svibanj", "lipanj", "srpanj", "kolovoz", "rujan", "listopad", "studeni", "prosinac"],
  weekdays: ["pon", "uto", "sri", "čet", "pet", "sub", "ned"],
};

describe("Croatian date format (UI-8A)", () => {
  it("parses d. M. yyyy. leniently and rejects impossible dates", () => {
    expect(parseHrDate("5. 11. 2026.")).toBe("2026-11-05");
    expect(parseHrDate("05.11.2026")).toBe("2026-11-05");
    expect(parseHrDate("29. 2. 2028.")).toBe("2028-02-29");
    expect(parseHrDate("29. 2. 2026.")).toBeNull();
    expect(parseHrDate("31. 4. 2026.")).toBeNull();
    expect(parseHrDate("2026-11-05")).toBeNull();
    expect(parseHrDate("")).toBeNull();
  });
  it("formats without leading zeros and returns '' for junk", () => {
    expect(formatHrDate("2026-11-05")).toBe("5. 11. 2026.");
    expect(formatHrDate("2026-13-01")).toBe("");
  });
  it("moves by days and months, clamping the day", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-15");
  });
  it("lays the month out Monday first", () => {
    const grid = monthGrid(2026, 11); // 1 Nov 2026 is a Sunday
    expect(grid[0]!.indexOf("2026-11-01")).toBe(6);
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid.flat().filter(Boolean)).toHaveLength(30);
  });
  it("maps grid keys", () => {
    expect(gridKeyTarget("2026-11-04", "ArrowRight")).toBe("2026-11-05");
    expect(gridKeyTarget("2026-11-04", "ArrowDown")).toBe("2026-11-11");
    expect(gridKeyTarget("2026-11-04", "PageDown")).toBe("2026-12-04");
    expect(gridKeyTarget("2026-11-04", "Home")).toBe("2026-11-02");
    expect(gridKeyTarget("2026-11-04", "End")).toBe("2026-11-08");
    expect(gridKeyTarget("2026-11-04", "a")).toBeNull();
  });
  it("respects min and max", () => {
    expect(inRange("2026-11-04", "2026-11-05")).toBe(false);
    expect(inRange("2026-11-05", "2026-11-05", "2026-11-05")).toBe(true);
  });
});

describe("DatePicker markup", () => {
  it("shows the Croatian value in a labelled field with an opener", () => {
    const html = renderToStaticMarkup(<DatePicker value="2026-11-05" onChange={() => undefined} labels={labels} today="2026-11-20" />);
    expect(html).toContain("Rok");
    expect(html).toContain('value="5. 11. 2026."');
    expect(html).toContain('aria-expanded="false"');
  });
  it("disables both the field and the opener", () => {
    const html = renderToStaticMarkup(<DatePicker value="" onChange={() => undefined} labels={labels} today="2026-11-20" disabled />);
    expect(html.match(/disabled/g)?.length).toBe(2);
  });
});
