import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { buildCover, monthYear } from "./cover";
import { CoverDialog } from "./CoverDialog";
import { CoverPage } from "./CoverPage";
import { PageFormatDialog } from "./PageFormatDialog";
import { derivePageFormat, textHeightCm } from "./page-format";

const profile = {
  label: "Izmišljeni fakultet, završni rad", font: "Times New Roman ili Arial", size: 12, spacing: 1.5,
  facts: ["Margine: lijevo 3 cm, ostale 2 cm", "Brojevi stranica u desnom kutu"],
  manualChecks: ["Numeriranje od uvoda", "Naslovnica prema predlošku"],
};

it("falls back to general values without a profile", () => {
  const format = derivePageFormat();
  expect(format).toMatchObject({ font: "Times New Roman", size: 12, spacing: 1.5, numberPosition: "center", numberStart: "intro" });
  expect(format.margins).toEqual({ top: 2.5, right: 2.5, bottom: 2.5, left: 2.5 });
  expect(Object.values(format.known).some(Boolean)).toBe(false);
});

it("reads margins, numbering and the first typeface from the rules", () => {
  const format = derivePageFormat(profile);
  expect(format.font).toBe("Times New Roman");
  expect(format.margins).toEqual({ top: 2, right: 2, bottom: 2, left: 3 });
  expect(format.numberPosition).toBe("right");
  expect(format.coverRules).toEqual(["Naslovnica prema predlošku"]);
  expect(format.sources).toContain("Margine: lijevo 3 cm, ostale 2 cm");
  expect(textHeightCm(format)).toBeCloseTo(25.7);
});

it("reads the two other margin forms and rejects values outside 1 to 5 cm", () => {
  expect(derivePageFormat({ facts: ["margine 3 / 2,5 cm"] }).margins).toEqual({ top: 2.5, right: 2.5, bottom: 2.5, left: 3 });
  expect(derivePageFormat({ facts: ["margine 2 cm"] }).margins.top).toBe(2);
  expect(derivePageFormat({ facts: ["margine 9 cm"] }).margins.top).toBe(2.5);
});

it("detects numbering on every page", () => {
  expect(derivePageFormat({ facts: ["Sve stranice se numeriraju"] }).numberStart).toBe("all");
});

it("builds the cover with fallbacks and the current month", () => {
  const now = new Date(2026, 10, 20);
  expect(monthYear(now)).toBe("studeni 2026.");
  const cover = buildCover({ student: " ", place: "" }, {}, now);
  expect(cover).toMatchObject({ unit: "Fakultet političkih znanosti", kind: "Rad", title: "Naslov rada", place: "Zagreb", date: "studeni 2026.", mentor: "" });
  expect(buildCover({ mentor: "Izmišljeni Mentor", date: "lipanj 2027." }, { title: "Izmišljeni rad" }, now))
    .toMatchObject({ mentor: "Izmišljeni Mentor", date: "lipanj 2027.", title: "Izmišljeni rad" });
});

it("renders the cover without an empty mentor or study line", () => {
  const html = renderToStaticMarkup(<CoverPage cover={buildCover({}, { title: "Izmišljeni rad" }, new Date(2026, 10, 1))} />);
  expect(html).toContain("Izmišljeni rad");
  expect(html).not.toContain("Mentor:");
});

it("shows page format values with their origin and the rules", () => {
  const html = renderToStaticMarkup(<PageFormatDialog format={derivePageFormat(profile)} onClose={() => {}} />);
  expect(html).toContain("lijevo 3 cm, desno 2 cm, gore 2 cm, dolje 2 cm");
  expect(html).toContain("dolje desno, od prve stranice teksta");
  expect(html).toContain("iz pravila fakulteta");
});

it("shows the general-layout note when the profile has no cover rules", () => {
  const html = renderToStaticMarkup(<CoverDialog value={{ student: "", mentor: "", study: "", place: "Zagreb", date: "" }}
    rules={[]} onApply={() => {}} onClose={() => {}} />);
  expect(html).toContain("Naslovnica je složena po općem obrascu");
  expect(html).toContain('value="Zagreb"');
});
