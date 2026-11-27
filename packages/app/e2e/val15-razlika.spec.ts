// WEB-V15-E2E (val 15, "Statistička analiza"): the page /analiza in the host, over a fake institution server
// (page.route). The calculation is answered by a small deterministic stand-in written here, from the body the page
// posts, so the page's request and its show of the answer are both checked. Invented data only (the three invented
// sets of the page). There is no resource of another person to fetch: the set travels in the body of the request and
// nothing is stored on the server, so "someone else's" does not exist and there is no 404 case for it.
import { createHash } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "./fixtures/test";

const PAGE = "/aplikacija/analiza";
const ME = { roles: ["student"], displayName: "Student A", institution: { slug: "izm", displayName: "Izmišljeni fakultet za testove" } };
const CATALOGUE = {
  limits: { maxRows: 500, maxColumns: 12, maxCellLength: 64, maxBodyBytes: 131072 },
  analyses: [
    { id: "descriptive", version: "1.0.0", variables: { kind: "numeric", min: 1, max: 12 } },
    { id: "frequencies", version: "1.0.0", variables: { kind: "any", min: 1, max: 12 } },
    { id: "correlation", version: "1.0.0", variables: { kind: "numeric", min: 2, max: 12 } },
  ],
};

type Cell = number | string | null;
type Body = {
  analysisId: "descriptive" | "correlation" | "frequencies"; analysisVersion: string; variables: string[];
  columns: { name: string; kind: string }[]; rows: Cell[][];
};
const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const round = (x: number) => Math.round(x * 1e6) / 1e6;
const numbers = (body: Body, name: string) => {
  const at = body.columns.findIndex((column) => column.name === name);
  return body.rows.map((row) => row[at]).filter((cell): cell is number => typeof cell === "number");
};

/** The stand-in server's answer to one posted set: same body, same bytes (no time, nothing random). */
function calculate(body: Body) {
  const picked = { columns: body.columns, rows: [...body.rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), variables: body.variables };
  let result;
  if (body.analysisId === "descriptive") {
    result = {
      kind: "descriptive",
      columns: body.variables.map((name) => {
        const values = numbers(body, name).sort((a, b) => a - b);
        const n = values.length;
        const mean = n === 0 ? null : values.reduce((s, v) => s + v, 0) / n;
        const sd = n < 2 || mean === null ? null : Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));
        const at = (p: number) => { const i = (n - 1) * p; const lo = Math.floor(i); return values[lo]! + (i - lo) * ((values[Math.ceil(i)] ?? values[lo]!) - values[lo]!); };
        const total = body.rows.length;
        return n === 0
          ? { name, n, missing: total, mean: null, sd: null, median: null, min: null, q1: null, q3: null, max: null }
          : { name, n, missing: total - n, mean: round(mean!), sd: sd === null ? null : round(sd), median: round(at(0.5)), min: values[0], q1: round(at(0.25)), q3: round(at(0.75)), max: values[n - 1] };
      }),
    };
  } else if (body.analysisId === "correlation") {
    const pairs = [];
    for (let i = 0; i < body.variables.length; i++) {
      for (let j = i + 1; j < body.variables.length; j++) {
        const a = body.columns.findIndex((c) => c.name === body.variables[i]);
        const b = body.columns.findIndex((c) => c.name === body.variables[j]);
        const both = body.rows.filter((r) => typeof r[a] === "number" && typeof r[b] === "number").map((r) => [r[a] as number, r[b] as number] as const);
        const n = both.length;
        const ma = both.reduce((s, p) => s + p[0], 0) / n;
        const mb = both.reduce((s, p) => s + p[1], 0) / n;
        const cov = both.reduce((s, p) => s + (p[0] - ma) * (p[1] - mb), 0);
        const va = both.reduce((s, p) => s + (p[0] - ma) ** 2, 0);
        const vb = both.reduce((s, p) => s + (p[1] - mb) ** 2, 0);
        pairs.push({ a: body.variables[i]!, b: body.variables[j]!, n, r: n < 3 || va === 0 || vb === 0 ? null : round(cov / Math.sqrt(va * vb)) });
      }
    }
    result = { kind: "correlation", pairs };
  } else {
    result = { kind: "frequencies", columns: [] };
  }
  return {
    analysisId: body.analysisId, analysisVersion: body.analysisVersion, datasetSha256: sha(picked), resultSha256: sha(result),
    rowCount: body.rows.length, result,
  };
}

type Reply = { status: number; body: unknown };
const problem = (status: number, code: string): Reply => ({
  status, body: { error: code, code, messageKey: `errors.${code}`, status, requestId: "00000000-0000-4000-8000-000000000001" },
});

/** The session, the catalogue and the calculation; `runs` records every body posted, `calls` counts the catalogue reads. */
async function fakeServer(page: Page, options: { catalogue?: Reply; run?: (n: number, body: Body) => Reply } = {}) {
  const seen = { runs: [] as Body[], calls: 0 };
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: ME }));
  await page.route("**/api/v1/analysis/catalogue", (route) => {
    seen.calls += 1;
    const reply = options.catalogue ?? { status: 200, body: CATALOGUE };
    return route.fulfill({ status: reply.status, json: reply.body });
  });
  await page.route("**/api/v1/analysis/runs", (route: Route) => {
    const body = route.request().postDataJSON() as Body;
    seen.runs.push(body);
    const reply = options.run?.(seen.runs.length, body) ?? { status: 200, body: calculate(body) };
    return route.fulfill({ status: reply.status, json: reply.body });
  });
  return seen;
}

const serious = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations
    .filter((v) => v.impact === "serious" || v.impact === "critical");

const SAMPLE = "Učitaj primjer: Izmišljeno istraživanje: kućno kompostiranje";

async function loadSample(page: Page) {
  await page.getByRole("button", { name: SAMPLE }).click();
  await expect(page.getByRole("button", { name: "Dalje" })).toBeEnabled();
}

/** From the dataset step to a result: the analysis and the columns by name, then Izračunaj. */
async function calculateOn(page: Page, analysis: string, columns: string[]) {
  await page.getByRole("button", { name: "Dalje" }).click();
  await page.getByLabel("Analiza", { exact: true }).selectOption({ label: analysis });
  for (const name of columns) await page.getByRole("checkbox", { name: new RegExp(`^${name} \\(`) }).check();
  await page.getByRole("button", { name: "Izračunaj" }).click();
}

const digests = async (page: Page) => {
  const found = await page.locator("dd code").allTextContents();
  return found.map((text) => text.replace(/\s/g, ""));
};

test("an invented sample, descriptive statistics and correlation: tables and fingerprints", async ({ page }) => {
  const seen = await fakeServer(page);
  await page.goto(PAGE);
  await expect(page.getByRole("heading", { level: 1, name: "Statistička analiza" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dalje" })).toBeDisabled();
  await loadSample(page);

  await calculateOn(page, "Opisna statistika", ["Biootpad kg tjedno", "Kompost kg tjedno"]);
  const table = page.getByRole("table", { name: "Opisna statistika po stupcima" });
  await expect(table.getByRole("row")).toHaveCount(3);
  const [dataset, result] = await digests(page);
  expect(dataset).toMatch(/^[0-9a-f]{64}$/);
  expect(result).toMatch(/^[0-9a-f]{64}$/);
  expect(seen.runs).toHaveLength(1);
  expect(seen.runs[0]).toMatchObject({ analysisId: "descriptive", analysisVersion: "1.0.0", variables: ["Biootpad kg tjedno", "Kompost kg tjedno"] });
  // The body carries no identity of anyone, only the invented set.
  expect(Object.keys(seen.runs[0]!).sort()).toEqual(["analysisId", "analysisVersion", "columns", "rows", "variables"]);
  // The numbers shown are the stand-in's, with the decimal comma.
  const mean = (calculate(seen.runs[0]!).result as { columns: { mean: number }[] }).columns[0]!.mean;
  await expect(table.getByRole("row", { name: /Biootpad kg tjedno/ })).toContainText(String(mean).replace(".", ","));

  await page.getByRole("button", { name: "Natrag" }).click();
  await page.getByLabel("Analiza", { exact: true }).selectOption({ label: "Korelacija" });
  for (const name of ["Biootpad kg tjedno", "Kompost kg tjedno"]) await page.getByRole("checkbox", { name: new RegExp(`^${name} \\(`) }).check();
  await page.getByRole("button", { name: "Izračunaj" }).click();
  await expect(page.getByRole("table", { name: "Pearsonov koeficijent korelacije po parovima" }).getByRole("row")).toHaveCount(2);
  await expect(page.getByRole("table", { name: "Matrica korelacije" })).toBeVisible();
  const [, correlationResult] = await digests(page);
  expect(correlationResult).not.toBe(result);
  expect(seen.runs).toHaveLength(2);
});

test("the same set and version twice give the same fingerprints; another choice gives another", async ({ page }) => {
  const seen = await fakeServer(page);
  await page.goto(PAGE);
  await loadSample(page);
  await calculateOn(page, "Opisna statistika", ["Biootpad kg tjedno"]);
  await expect(page.getByRole("table", { name: "Opisna statistika po stupcima" })).toBeVisible();
  const first = await digests(page);

  await page.getByRole("button", { name: "Nova analiza" }).click();
  await loadSample(page);
  await calculateOn(page, "Opisna statistika", ["Biootpad kg tjedno"]);
  await expect(page.getByRole("table", { name: "Opisna statistika po stupcima" })).toBeVisible();
  const second = await digests(page);

  expect(seen.runs).toHaveLength(2);
  expect(seen.runs[1]).toEqual(seen.runs[0]);
  expect(second).toEqual(first);

  await page.getByRole("button", { name: "Natrag" }).click();
  await page.getByLabel("Analiza", { exact: true }).selectOption({ label: "Opisna statistika" });
  for (const name of ["Biootpad kg tjedno", "Kompost kg tjedno"]) await page.getByRole("checkbox", { name: new RegExp(`^${name} \\(`) }).check();
  await page.getByRole("button", { name: "Izračunaj" }).click();
  await expect(page.getByRole("table", { name: "Opisna statistika po stupcima" }).getByRole("row")).toHaveCount(3);
  const third = await digests(page);
  expect(third[0]).not.toBe(first[0]);
});

test("a bad CSV shows the error, goes nowhere and nothing is sent", async ({ page }) => {
  const seen = await fakeServer(page);
  await page.goto(PAGE);
  await page.getByLabel("Ili zalijepite tekst").fill("A;B\n1;2;3\n");
  await page.getByRole("button", { name: "Učitaj skup" }).click();
  const alert = page.locator("main").getByRole("alert").filter({ hasText: /./ }).filter({ hasText: "Skup nije učitan" });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("Broj ćelija ne odgovara broju stupaca.");
  await expect(page.getByRole("button", { name: "Dalje" })).toBeDisabled();
  await expect(page.getByRole("status").filter({ hasText: "Za nastavak učitajte skup podataka." })).toBeVisible();
  expect(await serious(page)).toEqual([]);
  expect(seen.runs).toHaveLength(0);
});

test("a 503 on the calculation is not 'no data'; Pokušaj ponovno asks again", async ({ page }) => {
  const seen = await fakeServer(page, { run: (n, body) => (n === 1 ? problem(503, "unavailable") : { status: 200, body: calculate(body) }) });
  await page.goto(PAGE);
  await loadSample(page);
  await calculateOn(page, "Opisna statistika", ["Biootpad kg tjedno"]);
  await expect(page.locator("main").getByRole("alert").filter({ hasText: /./ })).toContainText("Rezultat trenutačno nije dostupan");
  await expect(page.getByText("Nema podataka za prikaz")).toHaveCount(0);
  await expect(page.getByRole("table")).toHaveCount(0);
  expect(await serious(page)).toEqual([]);
  await page.getByRole("button", { name: "Pokušaj ponovno" }).click();
  await expect(page.getByRole("table", { name: "Opisna statistika po stupcima" })).toBeVisible();
  expect(seen.runs).toHaveLength(2);
  expect(seen.runs[1]).toEqual(seen.runs[0]);
});

test("a 503 on the catalogue is not 'no data' either", async ({ page }) => {
  const seen = await fakeServer(page, { catalogue: problem(503, "unavailable") });
  await page.goto(PAGE);
  await expect(page.locator("main").getByRole("alert").filter({ hasText: /./ })).toContainText("Popis analiza trenutačno nije dostupan");
  await expect(page.getByRole("button", { name: "Dalje" })).toHaveCount(0);
  expect(await serious(page)).toEqual([]);
  expect(seen.calls).toBe(1);
});

test("a 404 shows 'Funkcija nije uključena.', not an error", async ({ page }) => {
  await fakeServer(page, { catalogue: problem(404, "not_found") });
  await page.goto(PAGE);
  await expect(page.getByText("Funkcija nije uključena.")).toBeVisible();
  await expect(page.getByText("trenutačno nije dostupan")).toHaveCount(0);
  await expect(page.getByText("nije moguće učitati")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Učitaj skup" })).toHaveCount(0);
  expect(await serious(page)).toEqual([]);
});

test("a 422 on the calculation shows the refused state; a 404 on it shows the function off", async ({ page }) => {
  await fakeServer(page, { run: (n) => (n === 1 ? problem(422, "invalid_input") : problem(404, "not_found")) });
  await page.goto(PAGE);
  await loadSample(page);
  await calculateOn(page, "Opisna statistika", ["Biootpad kg tjedno"]);
  await expect(page.locator("main").getByRole("alert").filter({ hasText: /./ })).toContainText("Poslužitelj nije prihvatio skup podataka");
  await page.getByRole("button", { name: "Natrag" }).click();
  await page.getByLabel("Analiza", { exact: true }).selectOption({ label: "Opisna statistika" });
  await page.getByRole("checkbox", { name: /^Biootpad kg tjedno \(/ }).check();
  await page.getByRole("button", { name: "Izračunaj" }).click();
  await expect(page.locator("main").getByRole("alert").filter({ hasText: /./ })).toContainText("Funkcija nije uključena.");
});

test("axe at 1250 and 400 px on the set, the choice and the result", async ({ page }) => {
  await fakeServer(page);
  await page.setViewportSize({ width: 1250, height: 900 });
  await page.goto(PAGE);
  await expect(page.getByRole("heading", { level: 1, name: "Statistička analiza" })).toBeVisible();
  expect(await serious(page)).toEqual([]);
  await loadSample(page);
  await page.getByRole("button", { name: "Dalje" }).click();
  await page.getByLabel("Analiza", { exact: true }).selectOption({ label: "Korelacija" });
  await page.getByRole("checkbox", { name: /^Biootpad kg tjedno \(/ }).check();
  await page.getByRole("checkbox", { name: /^Kompost kg tjedno \(/ }).check();
  expect(await serious(page)).toEqual([]);
  await page.getByRole("button", { name: "Izračunaj" }).click();
  await expect(page.getByRole("table", { name: "Matrica korelacije" })).toBeVisible();
  expect(await serious(page)).toEqual([]);
  await page.setViewportSize({ width: 400, height: 860 });
  expect(await serious(page)).toEqual([]);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});
