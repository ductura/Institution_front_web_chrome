// LOK-WEB-26: the default answer of the shared fake institution server. Every
// operation of the generated server contract answers with one of its own
// successful vectors, so a page that starts reading a new operation does not
// break the e2e of other pages; a spec overrides only the routes it tests.
// A request outside the contract has no default and fails loudly.
// Invented data only: the vectors are the contract's own invented examples.
import { readFileSync } from "node:fs";

type Contract = Record<string, { path: string; method: string; responses?: Record<string, unknown> }>;
type Vector = { route: string; name: string; response?: { status: number; body?: unknown; contentType?: string } };

export type DefaultAnswer = { operation: string; status: number; contentType?: string; body?: string };

/** On a tie in size, vectors whose name says the page stays empty come first. */
const QUIET = ["empty", "ready-empty", "none", "nothing-recorded", "none-or-not-the-teacher"];
const rank = (v: Vector) => { const i = QUIET.indexOf(v.name); return i === -1 ? QUIET.length : i; };

const size = (v: Vector) => JSON.stringify(v.response?.body ?? null).length;

/** Builds the resolver from a contract and its vectors (the generated files by default). */
export function contractDefaults(contract: Contract, vectors: readonly Vector[]) {
  const routes = Object.entries(contract).map(([operation, { path, method, responses }]) => {
    const params = (path.match(/\{[^}]+\}/g) ?? []).length;
    const pattern = new RegExp(`^${path.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\\?\{[^}]+\\?\}/g, "[^/]+")}$`);
    const ok = vectors.filter((v) => v.route === operation && v.response !== undefined && v.response.status >= 200 && v.response.status < 300);
    // The smallest successful vector, so a default never adds content a spec did not ask for.
    const chosen = [...ok].sort((a, b) => size(a) - size(b) || rank(a) - rank(b))[0];
    let answer: DefaultAnswer | null = null;
    if (chosen?.response !== undefined) {
      const { status, body, contentType } = chosen.response;
      answer = {
        operation, status, contentType: contentType ?? (body === undefined ? undefined : "application/json"),
        body: body === undefined ? undefined : typeof body === "string" && contentType !== "application/json" ? body : JSON.stringify(body),
      };
    } else if (responses !== undefined && "204" in responses) {
      answer = { operation, status: 204 };
    }
    return { operation, method: method.toUpperCase(), pattern, params, answer };
  });
  // Literal segments win over parameters (/works/{id}/milestones before /works/{id}/{x}).
  routes.sort((a, b) => a.params - b.params);

  return {
    /** The contract operation of a request, or null when the request is outside the contract. */
    operation(method: string, pathname: string) {
      return routes.find((r) => r.method === method.toUpperCase() && r.pattern.test(pathname)) ?? null;
    },
    /** Operations with neither a successful vector nor a 204; a spec that reaches one must fake it. */
    withoutDefault() {
      return routes.filter((r) => r.answer === null).map((r) => r.operation).sort();
    },
  };
}

const read = <T>(path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as T;

export const generatedDefaults = () => contractDefaults(
  read<Contract>("../../../../src/client/migration-contracts.generated.json"),
  read<Vector[]>("../../../../src/client/migration-contract-vectors.generated.json"),
);
