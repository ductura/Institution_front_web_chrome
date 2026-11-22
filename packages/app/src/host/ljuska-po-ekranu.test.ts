import { describe, expect, it } from "vitest";

import { PAGES } from "../routes";
import { BEZ_LJUSKE, ljuskaOf } from "./ljuska-po-ekranu";

describe("ljuska po ekranu (VIZ-CSS)", () => {
  it("leaves the prototype's shell: 'none' screens without the rail", () => {
    expect(ljuskaOf("/rad/[assignmentId]")).toBe("none");
    expect(ljuskaOf("/rad/[assignmentId]/predaja/pregled")).toBe("none");
    expect(ljuskaOf("/nastavnik/rad/[id]/sazetak")).toBe("none");
  });

  it("keeps the rail elsewhere", () => {
    expect(ljuskaOf("/zadaci")).toBe("side");
    expect(ljuskaOf("/nastavnik/kolegiji")).toBe("side");
    expect(ljuskaOf("/rad/[assignmentId]/dnevnik-pristupa")).toBe("side");
  });

  it("names only routes the app has", () => {
    const routes = new Set(PAGES.map((p) => p.path));
    for (const path of Object.keys(BEZ_LJUSKE)) expect(routes, path).toContain(path);
  });
});
