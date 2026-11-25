import { ANALYSIS_LIMITS } from "../api/limits";
import type { AnalysisCatalogue } from "../api/read";
import type { AnalysisRequest } from "../api/run";

/** The set as the contract carries it: flat `columns` and `rows` (no `dataset` key). */
export type Dataset = Pick<AnalysisRequest, "columns" | "rows">;
export type AnalysisSpec = AnalysisCatalogue["analyses"][number];
export type Column = Dataset["columns"][number];

/** What the user picked: an analysis id and the names of the columns. Nothing else, so no identity can ride along. */
export type Choice = { readonly analysisId: AnalysisSpec["id"]; readonly variables: readonly string[] };

export type Refusal =
  | { reason: "noAnalysis" | "noRows" | "unknownColumn" | "duplicate" | "limits" | "unknownAnalysis" }
  | { reason: "tooFew"; min: number; count: number }
  | { reason: "tooMany"; max: number; count: number }
  | { reason: "wrongKind"; name: string };
export type Built = { ok: true; request: AnalysisRequest } | ({ ok: false } & Refusal);

/** The columns the analysis can take: a numeric-only analysis is never offered a category column. */
export function eligibleColumns(dataset: Dataset, spec: AnalysisSpec): Column[] {
  return dataset.columns.filter((column) => spec.variables.kind === "any" || column.kind === "numeric");
}

const bodyBytes = (request: AnalysisRequest) => new TextEncoder().encode(JSON.stringify(request)).length;

/**
 * Checks the choice against the catalogue and the set, then builds the request body. Pure and deterministic: the same
 * set, catalogue and choice give an equal body; the chosen names are put in the order of the set's columns so the
 * order the boxes were ticked in does not change it. Only `analysisId`, `analysisVersion`, `variables`, `columns` and
 * `rows` are copied, so an extra property on the input never reaches the server. A choice the contract refuses
 * is never built.
 */
export function buildRequest(dataset: Dataset, choice: Choice, catalogue: AnalysisCatalogue): Built {
  const spec = catalogue.analyses.find((entry) => entry.id === choice.analysisId);
  if (spec === undefined) return { ok: false, reason: "unknownAnalysis" };
  if (dataset.rows.length === 0) return { ok: false, reason: "noRows" };
  if (dataset.rows.length > ANALYSIS_LIMITS.maxRows || dataset.columns.length > ANALYSIS_LIMITS.maxColumns) return { ok: false, reason: "limits" };
  const names = choice.variables;
  if (new Set(names).size !== names.length) return { ok: false, reason: "duplicate" };
  for (const name of names) {
    const column = dataset.columns.find((entry) => entry.name === name);
    if (column === undefined) return { ok: false, reason: "unknownColumn" };
    if (spec.variables.kind === "numeric" && column.kind !== "numeric") return { ok: false, reason: "wrongKind", name };
  }
  if (names.length < spec.variables.min) return { ok: false, reason: "tooFew", min: spec.variables.min, count: names.length };
  if (names.length > spec.variables.max) return { ok: false, reason: "tooMany", max: spec.variables.max, count: names.length };
  const request: AnalysisRequest = {
    analysisId: spec.id,
    analysisVersion: spec.version,
    variables: dataset.columns.filter((column) => names.includes(column.name)).map((column) => column.name),
    columns: dataset.columns.map(({ name, kind }) => ({ name, kind })),
    rows: dataset.rows.map((row) => [...row]),
  };
  if (bodyBytes(request) > ANALYSIS_LIMITS.maxBodyBytes) return { ok: false, reason: "limits" };
  return { ok: true, request };
}
