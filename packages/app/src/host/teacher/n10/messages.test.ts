import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { n10Messages as m } from "./messages.hr";

describe("N-10 messages", () => {
  it("keeps the prototype wording", () => {
    expect(m.intro).toBe("Isti sažetak vide student i nastavnik. Vremena su po zagrebačkom vremenu, zaokružena na minutu.");
    expect(m.loading).toBe("Učitavam sažetak procesa…");
    expect(m.error).toBe("Sažetak procesa trenutačno nije moguće učitati. Pokušajte ponovno; zapis time nije zahvaćen.");
    expect(m.empty).toBe("Rad još nije započet, pa sažetka procesa nema.");
    expect(m.sessionsMeta("30 minuta", true)).toBe(
      "Sesija je niz promjena bez prekida duljeg od 30 minuta (prag P-01, postavka fakulteta). Raspon praznine nije uračunat.");
    expect(m.activeLabel("6 sesija")).toBe("Zbroj trajanja 6 sesija");
    expect(m.pastesMeta("200 znakova")).toBe(
      "Popisano je svako lijepljenje dulje od 200 znakova (prag P-02, postavka fakulteta). Vrijeme je zaokruženo na odsječak zapisa. Bez zbroja.");
    expect(m.gap("26. 10. 2026. u 21:45", "28. 10. 2026. u 10:50")).toBe(
      "Od verzije 26. 10. 2026. u 21:45 do verzije 28. 10. 2026. u 10:50. Poslužitelj je primio obje verzije, ali ne i odsječke između njih, pa promjene u tom rasponu nisu zabilježene pojedinačno.");
    expect([m.stateComplete, m.stateGaps, m.stateUnchanged]).toEqual([
      "Zapis je cjelovit.", "Zapis ima praznine (vidi popis).", "Zapis je neizmijenjen od primitka na poslužitelj."]);
  });

  it("holds no forbidden term (Ductus PRODUCT §5)", () => {
    const filled = Object.values(m).map((v) => (typeof v === "function" ? (v as (a: string, b: string | boolean) => string)("1", true) : v));
    for (const value of filled) expect(findForbiddenTerms(value, "hr")).toEqual([]);
  });
});
