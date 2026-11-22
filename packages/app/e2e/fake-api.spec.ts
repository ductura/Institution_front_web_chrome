// LOK-WEB-26: the shared fake server answers every operation of the server
// contract by itself, so a page that starts reading a new operation does not
// break the e2e of pages that never fake it. No page is needed here.
import { readFileSync } from "node:fs";

import { expect, test } from "./fixtures/test";
import { contractDefaults } from "./fixtures/contract-api";

const read = <T>(path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as T;
const contract = read<Record<string, { path: string; method: string; responses?: Record<string, unknown> }>>(
  "../../../src/client/migration-contracts.generated.json");
const vectors = read<{ route: string; name: string; response?: { status: number; body?: unknown } }[]>(
  "../../../src/client/migration-contract-vectors.generated.json");

const concrete = (path: string) => path.replace(/\{[^}]+\}/g, "izmisljeni-1");

test("every operation of the contract is recognised at its own address", () => {
  const defaults = contractDefaults(contract, vectors);
  const wrong = Object.entries(contract)
    .map(([operation, { path, method }]) => ({ operation, found: defaults.operation(method, concrete(path))?.operation ?? null }))
    .filter(({ operation, found }) => found !== operation && contract[found ?? ""]?.path !== contract[operation]?.path);
  expect(wrong).toEqual([]);
});

test("every operation with a successful vector answers it by default", () => {
  const defaults = contractDefaults(contract, vectors);
  const withVector = new Set(vectors.filter((v) => (v.response?.status ?? 0) >= 200 && (v.response?.status ?? 0) < 300).map((v) => v.route));
  for (const [operation, { path, method }] of Object.entries(contract)) {
    if (!withVector.has(operation)) continue;
    const answer = defaults.operation(method, concrete(path))?.answer;
    expect(answer?.status, operation).toBeGreaterThanOrEqual(200);
    expect(answer?.status, operation).toBeLessThan(300);
  }
});

test("an operation added to the contract is answered without any spec change", () => {
  const added = {
    ...contract,
    "teacher.izmisljena-operacija.get": { path: "/api/v1/teacher/izmisljeno/{assignmentId}/popis", method: "GET" },
  };
  const defaults = contractDefaults(added, [
    ...vectors,
    { route: "teacher.izmisljena-operacija.get", name: "empty", response: { status: 200, body: { rows: [] } } },
  ]);
  const match = defaults.operation("GET", "/api/v1/teacher/izmisljeno/izmisljeni-1/popis");
  expect(match?.operation).toBe("teacher.izmisljena-operacija.get");
  expect(match?.answer).toMatchObject({ status: 200, contentType: "application/json", body: "{\"rows\":[]}" });
});

test("the quietest vector is the default, and a 204-only operation answers 204", () => {
  const defaults = contractDefaults({
    "x.lista.get": { path: "/api/v1/x/lista", method: "GET" },
    "x.brisanje.delete": { path: "/api/v1/x/lista/{id}", method: "DELETE", responses: { 204: {} } },
  }, [
    { route: "x.lista.get", name: "ready", response: { status: 200, body: { rows: [1, 2, 3] } } },
    { route: "x.lista.get", name: "empty", response: { status: 200, body: { rows: [] } } },
  ]);
  expect(defaults.operation("GET", "/api/v1/x/lista")?.answer?.body).toBe("{\"rows\":[]}");
  expect(defaults.operation("DELETE", "/api/v1/x/lista/izmisljeni-1")?.answer).toEqual({ operation: "x.brisanje.delete", status: 204 });
  expect(defaults.withoutDefault()).toEqual([]);
});

test("a request outside the contract has no default", () => {
  const defaults = contractDefaults(contract, vectors);
  expect(defaults.operation("GET", "/api/v1/izmisljeno/nepostojece")).toBeNull();
  expect(defaults.operation("PATCH", "/api/v1/me")).toBeNull();
});
