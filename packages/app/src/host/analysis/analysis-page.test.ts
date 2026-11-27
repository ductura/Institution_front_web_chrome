// @vitest-environment jsdom
// WEB-V15-STRANICA: the page puts the parts together; the route is mounted, not only present in a test. Data is invented.
import { existsSync } from "node:fs";
import { join } from "node:path";

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { findForbiddenTerms } from "../../../../../scripts/forbidden-terms/terms.ts";
import { PAGES, resolve } from "../../routes";
import type { AnalysisCatalogue } from "./api/read";
import type { AnalysisRun } from "./api/run";
import { AnalysisPage, canEnter, type AnalysisPageProps } from "./AnalysisPage";
import { analysisPageMessages } from "./messages.hr";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CATALOGUE: AnalysisCatalogue = {
  limits: { maxRows: 500, maxColumns: 12, maxCellLength: 64, maxBodyBytes: 131072 },
  analyses: [
    { id: "descriptive", version: "1.0.0", variables: { kind: "numeric", min: 1, max: 12 } },
    { id: "frequencies", version: "1.0.0", variables: { kind: "any", min: 1, max: 12 } },
    { id: "correlation", version: "1.0.0", variables: { kind: "numeric", min: 2, max: 12 } },
  ],
};
const DATASET = { columns: [{ name: "a", kind: "numeric" as const }], rows: [[1], [2]] };

let root: Root | null = null;
let el: HTMLElement | null = null;
const flush = () => act(async () => { await Promise.resolve(); });

async function mount(props: AnalysisPageProps): Promise<HTMLElement> {
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
  await act(async () => root!.render(createElement(AnalysisPage, props)));
  await flush();
  return el;
}
const button = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(text)) as HTMLButtonElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  el?.remove();
  root = el = null;
});

describe("koraci", () => {
  it("korak naprijed bez skupa je nemoguć, rezultat bez izračuna također", () => {
    expect(canEnter("dataset", null, null)).toBe(true);
    expect(canEnter("analysis", null, null)).toBe(false);
    expect(canEnter("result", null, null)).toBe(false);
    expect(canEnter("analysis", DATASET, null)).toBe(true);
    expect(canEnter("result", DATASET, null)).toBe(false);
    expect(canEnter("result", DATASET, { kind: "loading" })).toBe(true);
    expect(canEnter("result", null, { kind: "loading" })).toBe(false);
  });
});

describe("ruta je montirana", () => {
  it("ima zapis u PAGES i Next stranicu u app/(host)", () => {
    const page = PAGES.find((p) => p.path === "/analiza");
    expect(page?.label).toBe("Statistička analiza");
    expect(page?.roles).toEqual(["teacher", "student"]);
    expect(page?.public).toBeUndefined();
    expect(existsSync(join(__dirname, "../../../app/(host)/analiza/page.tsx"))).toBe(true);
  });

  it("bez sesije vodi na prijavu, administrator ide na svoj početak, nastavnik i student otvaraju", () => {
    expect(resolve("/analiza", null)).toEqual({ kind: "redirect", to: "/" });
    expect(resolve("/analiza", "admin").kind).toBe("redirect");
    expect(resolve("/analiza", "teacher").kind).toBe("page");
    expect(resolve("/analiza", "student").kind).toBe("page");
  });
});

describe("stranica", () => {
  it("isključena funkcija (404) daje poruku „Funkcija nije uključena”, a ne grešku", async () => {
    const out = await mount({ read: async () => ({ kind: "off" }) });
    expect(out.textContent).toContain("Funkcija nije uključena.");
    expect(out.querySelector("[role=alert]")).toBeNull();
    expect(out.querySelector("input[type=file]")).toBeNull();
  });

  it("503 nije „nema podataka”: greška i „Pokušaj ponovno” koji čita ponovno", async () => {
    const read = vi.fn<NonNullable<AnalysisPageProps["read"]>>()
      .mockResolvedValueOnce({ kind: "unavailable" })
      .mockResolvedValueOnce({ kind: "ready", data: CATALOGUE });
    const out = await mount({ read });
    expect(out.textContent).toContain(analysisPageMessages.unavailable);
    await act(async () => button(out, "Pokušaj ponovno")!.click());
    await flush();
    expect(read).toHaveBeenCalledTimes(2);
    expect(out.querySelector("input[type=file]")).not.toBeNull();
  });

  it("bez skupa „Dalje” je onemogućeno; nakon primjera je moguće i vodi na odabir analize", async () => {
    const out = await mount({ read: async () => ({ kind: "ready", data: CATALOGUE }) });
    expect(out.textContent).toContain(analysisPageMessages.needDataset);
    expect(button(out, "Dalje")!.disabled).toBe(true);
    const sample = [...out.querySelectorAll("button")].find((b) => b.getAttribute("aria-label")?.startsWith("Učitaj primjer:"))!;
    await act(async () => sample.click());
    expect(out.textContent).not.toContain(analysisPageMessages.needDataset);
    const next = button(out, "Dalje")!;
    expect(next.disabled).toBe(false);
    await act(async () => next.click());
    expect(out.querySelector("#choose-heading")).not.toBeNull();
    expect(out.querySelector("[aria-current=step]")?.textContent).toBe("Analiza");
  });

  it("izračun: zahtjev ide samo kroz run, 503 u rezultatu nije prazno stanje, ponovi šalje isti zahtjev", async () => {
    const run = vi.fn<NonNullable<AnalysisPageProps["run"]>>(async (): Promise<Exclude<AnalysisRun, never>> => ({ kind: "unavailable" }));
    const out = await mount({ read: async () => ({ kind: "ready", data: CATALOGUE }), run });
    const sample = [...out.querySelectorAll("button")].find((b) => b.getAttribute("aria-label")?.startsWith("Učitaj primjer:"))!;
    await act(async () => sample.click());
    await act(async () => button(out, "Dalje")!.click());
    const select = out.querySelector("select")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, "frequencies");
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const box = out.querySelector("input[type=checkbox]") as HTMLInputElement;
    await act(async () => box.click());
    await act(async () => button(out, "Izračunaj")!.click());
    await flush();
    expect(run).toHaveBeenCalledTimes(1);
    const sent = run.mock.calls[0]![0];
    expect(Object.keys(sent).sort()).toEqual(["analysisId", "analysisVersion", "columns", "rows", "variables"]);
    expect(out.textContent).toContain(resultMessages().unavailable);
    expect(out.textContent).not.toContain("Nema podataka za prikaz");
    await act(async () => button(out, "Pokušaj ponovno")!.click());
    await flush();
    expect(run).toHaveBeenCalledTimes(2);
    expect(run.mock.calls[1]![0]).toEqual(sent);
  });

  it("primjer nakon CSV-a: pregled učitanog skupa se ne zadržava (jedan aktivan skup)", async () => {
    const out = await mount({ read: async () => ({ kind: "ready", data: CATALOGUE }) });
    const area = out.querySelector("textarea")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(area, "xx;yy\n1;2\n3;4\n");
      area.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => button(out, "Učitaj")!.click());
    expect(out.textContent).toContain("xx");
    const sample = [...out.querySelectorAll("button")].find((b) => b.getAttribute("aria-label")?.startsWith("Učitaj primjer:"))!;
    await act(async () => sample.click());
    expect(out.textContent).not.toContain("xx");
  });

  it("tekstovi stranice ne sadrže zabranjene izraze", () => {
    expect(findForbiddenTerms(Object.values(analysisPageMessages).flatMap((v) => (typeof v === "string" ? [v] : Object.values(v))).join("\n"))).toEqual([]);
  });
});

function resultMessages() {
  return { unavailable: "Rezultat trenutačno nije dostupan. Pokušajte ponovno." };
}
