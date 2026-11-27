// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { FAKE_COMPLETE, FAKE_EMPTY, fakeN10Port } from "./fake-port";
import type { N10Port } from "./model";
import SummaryPage from "./SummaryPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;

async function show(port: N10Port, anchors?: ReadonlySet<string>) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(h(SummaryPage, { port, documentId: "d1", workHref: "/aplikacija/nastavnik/rad/d1", signInHref: "/x", anchors }));
  });
  return host;
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

describe("N-10 SummaryPage", () => {
  it("shows a skeleton while the summary loads", async () => {
    const never = () => new Promise<never>(() => {});
    const host = await show({ summary: never, details: never, versions: never });
    expect(host.querySelector("h1")?.textContent).toBe("Sažetak procesa");
    expect(host.querySelector('[role="status"]')?.textContent).toContain("Učitavam sažetak procesa…");
    expect(host.querySelector("a")?.getAttribute("href")).toBe("/aplikacija/nastavnik/rad/d1");
  });

  it("shows the error with a retry that reads again", async () => {
    let calls = 0;
    const port = { ...fakeN10Port(), summary: async () => (++calls === 1 ? { kind: "unavailable" as const } : (await fakeN10Port().summary("d1"))) };
    const host = await show(port);
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(
      "Sažetak procesa trenutačno nije moguće učitati. Pokušajte ponovno; zapis time nije zahvaćen.");
    await act(async () => { host.querySelector("button")!.click(); });
    expect(calls).toBe(2);
    expect(host.textContent).toContain("Razdoblje rada");
  });

  it("says the work is not started when nothing was recorded", async () => {
    const host = await show(fakeN10Port(FAKE_EMPTY));
    expect(host.textContent).toContain("Rad još nije započet, pa sažetka procesa nema.");
    expect(host.textContent).not.toContain("Razdoblje rada");
  });

  it("draws every section of the prototype, in order", async () => {
    const host = await show(fakeN10Port());
    const titles = [...host.querySelectorAll("h2")].map((e) => e.textContent);
    expect(titles).toEqual(["Razdoblje rada", "Sesije", "Aktivno vrijeme uređivanja", "Verzije", "Lijepljenja", "AI pomoćnik",
      "Praznine u zapisu", "Napomene studenta", "Stanje zapisa", "Karta podrijetla"]);
    const text = host.textContent ?? "";
    expect(text).toContain("Isti sažetak vide student i nastavnik.");
    expect(text).toContain("20. 10. 2026. u 18:05");
    expect(text).toContain("2 sesije");
    expect(text).toContain("Raspon praznine nije uračunat.");
    expect(text).toContain("2 h 55 min");
    expect(text).toContain("28. 10. 2026. u 10:50 · poslano na pregled");
    expect(text).toContain("5. 11. 2026. u 21:14 · predano");
    expect(text).toContain("20. 10. 2026., odsječak oko 18:35 · 640 znakova");
    expect(text).toContain("Izvor nije opažen.");
    expect(text).toContain("28. 10. 2026., odsječak oko 10:05");
    expect(text).toContain("Zapis ima praznine (vidi popis).");
    expect(text).toContain("Zapis je neizmijenjen od primitka na poslužitelj.");
    expect(text).not.toContain("Prikaži mjesto u radu");
  });

  it("says plainly what the server does not give", async () => {
    const host = await show(fakeN10Port(FAKE_COMPLETE, { kind: "unavailable" }, { kind: "unavailable" }, undefined, { kind: "unavailable" }));
    expect(host.querySelectorAll("p.meta").length).toBeGreaterThan(0);
    expect((host.textContent ?? "").match(/Trenutačno nije dostupno\./g)?.length).toBe(4);
    expect(host.textContent).toContain("Zapis nema praznina.");
    expect(host.textContent).toContain("Zapis je cjelovit.");
    expect(host.textContent).not.toContain("Raspon praznine nije uračunat.");
  });

  it("offers the jump only for an anchor the map reports", async () => {
    const host = await show(fakeN10Port(), new Set(["pv-paste-1"]));
    expect([...host.querySelectorAll("section a")].map((b) => b.textContent)).toEqual(["Prikaži mjesto u radu"]);
  });
});
