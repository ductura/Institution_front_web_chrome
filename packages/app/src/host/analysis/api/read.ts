import { createApi, type ApiOptions, type ApiResult } from "@/client/api";

const OPERATION = "analysis.catalogue.get";
export type AnalysisCatalogue = Extract<ApiResult<typeof OPERATION>, { ok: true }>["body"];

/**
 * Outcomes of reading the catalogue, each its own state: `off` is the function switched off (404, shown as "not
 * switched on"), `signedOut` is 401 (the page goes to sign-in), `denied` is 403 (the page says it is not for this
 * account), `unavailable` is a 503 or a transport failure, `failed` is anything else (a body the contract does not
 * declare). None of them is ever an empty catalogue.
 */
export type CatalogueRead =
  | { kind: "ready"; data: AnalysisCatalogue }
  | { kind: "off" | "unavailable" | "signedOut" | "denied" }
  | { kind: "failed"; status: number; code: string };

export type CatalogueState = CatalogueRead | { kind: "loading" };

export async function readCatalogue(options?: ApiOptions): Promise<CatalogueRead> {
  let answer: ApiResult<typeof OPERATION>;
  try {
    const call = createApi(options);
    answer = await call(OPERATION, { params: undefined, query: {}, body: undefined });
  } catch {
    return { kind: "unavailable" };
  }
  if (answer.ok) return { kind: "ready", data: answer.body };
  if (answer.status === 404) return { kind: "off" };
  if (answer.status === 401) return { kind: "signedOut" };
  if (answer.status === 403) return { kind: "denied" };
  if (answer.status === 503) return { kind: "unavailable" };
  return { kind: "failed", status: answer.status, code: answer.code };
}
