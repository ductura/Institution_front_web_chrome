// The only way the web calls the API (DAN-752, web 2.c3). It wraps the client
// generated from @ductura/contracts and adds what the generated client does not
// do: input is checked before anything goes on the wire, and a success answer
// must match its response schema in openapi/v1.json exactly, so an unknown
// field is a contract break ("unexpected"), never passed on silently.
// The one exception is evidence ingest (evidence/open, evidence/commit): see
// README.md. no-direct-api.test.ts keeps every other call out of the code.
import { createClient, validateInput, type OperationId, type Operations, type Result } from "@ductura/contracts";
import openapi from "@ductura/contracts/openapi/v1.json" with { type: "json" };
import { matchesSchema, type Schema } from "./schema-check";

type ResponseSpec = { readonly content?: Readonly<Record<string, { readonly schema?: Schema }>> };
type OpenApi = {
  readonly paths: Readonly<Record<string, Readonly<Record<string, {
    readonly operationId: string;
    readonly responses: Readonly<Record<string, ResponseSpec>>;
  }>>>>;
};

/** Responses of every operation of the contract, by operationId, then status. */
export const RESPONSES: ReadonlyMap<string, Readonly<Record<string, ResponseSpec>>> = new Map(
  Object.values((openapi as unknown as OpenApi).paths).flatMap((methods) =>
    Object.values(methods).map((op) => [op.operationId, op.responses] as const),
  ),
);

export type Input<Id extends OperationId> = Pick<Operations[Id], "params" | "query" | "body">;

/** Refused before the request was sent: the input breaks the contract. */
export type Rejected = { ok: false; status: 0; code: "client_rejected" };
export type ApiResult<Id extends OperationId> = Result<Id> | Rejected;

const PARTS = ["params", "query", "body"] as const;

/** True when a success answer is exactly what the contract declares for its status. */
export function responseMatches(id: string, status: number, body: unknown): boolean {
  const spec = RESPONSES.get(id)?.[String(status)];
  if (spec === undefined) return false;
  const schema = spec.content?.["application/json"]?.schema;
  if (schema === undefined) return body === undefined;
  return body !== undefined && matchesSchema(schema, body);
}

export type ApiOptions = {
  /** Origin of the API; the page's own origin by default (same domain, /api/v1). */
  readonly baseUrl?: string;
  /** Transport for tests; the browser's fetch by default. */
  readonly fetchImpl?: typeof fetch;
};

export function createApi(options: ApiOptions = {}) {
  const baseUrl = options.baseUrl ?? globalThis.location.origin;
  const call = createClient(baseUrl, options.fetchImpl ?? ((input, init) => fetch(input, init)));
  return async function api<Id extends OperationId>(id: Id, input: Input<Id>): Promise<ApiResult<Id>> {
    if (!RESPONSES.has(id) || !PARTS.every((part) => validateInput(id, part, input[part]))) {
      return { ok: false, status: 0, code: "client_rejected" };
    }
    let result: Result<Id>;
    try {
      result = await call(id, input);
    } catch (error) {
      // A JSON content type with a body that is not JSON breaks the contract too.
      if (error instanceof SyntaxError) return { ok: false, status: 0, code: "unexpected" } as Result<Id>;
      throw error;
    }
    if (!result.ok) return result;
    const { status, body } = result as unknown as { status: number; body: unknown };
    return responseMatches(id, status, body) ? result : ({ ok: false, status, code: "unexpected" } as Result<Id>);
  };
}
