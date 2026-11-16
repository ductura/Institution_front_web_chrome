// The only way the web calls the API (DAN-752, web 2.c3). It wraps the client
// generated from @ductura/contracts and adds what the generated client does not
// do: the input is copied once and only that copy is checked and sent, the web
// sends no field the contract does not name, and a success answer must match
// its response schema in openapi/v1.json exactly, so an unknown field is a
// contract break ("unexpected"), never passed on silently. Contract 2.0.0
// leaves three places open, and only these: the live document body that
// live.document.put sends (any field name), the snapshot of live.document.get
// and the empty anchor of a collaboration list item. A 409 of live.document.put
// and collaboration.revision-requests.post can be an answer (ok), checked
// against its own schema like a 2xx.
// Evidence ingest is the recorded exception: see README.md. no-direct-api.test.ts
// keeps every other call out of the code.
import { createClient, validateInput, type OperationId, type Operations, type Result } from "@ductura/contracts";
import openapi from "@ductura/contracts/openapi/v1.json" with { type: "json" };
import { matchesSchema, type Schema } from "./schema-check";

type ResponseSpec = { readonly content?: Readonly<Record<string, { readonly schema?: Schema }>> };
type BodySchema = { readonly properties?: object; readonly anyOf?: readonly BodySchema[]; readonly additionalProperties?: unknown };
type Operation = {
  readonly operationId: string;
  readonly parameters?: readonly { readonly name: string; readonly in: string }[];
  readonly requestBody?: { readonly content: Readonly<Record<string, { readonly schema: BodySchema }>> };
  readonly responses: Readonly<Record<string, ResponseSpec>>;
};
const OPERATIONS: readonly Operation[] = Object.values(
  (openapi as unknown as { paths: Record<string, Record<string, Operation>> }).paths,
).flatMap((methods) => Object.values(methods));

/** Responses of every operation of the contract, by operationId, then status. */
export const RESPONSES: ReadonlyMap<string, Readonly<Record<string, ResponseSpec>>> = new Map(
  OPERATIONS.map((op) => [op.operationId, op.responses] as const),
);

const PARTS = ["params", "query", "body"] as const;
type Part = (typeof PARTS)[number];

/** The field names a body schema gives: every branch of an anyOf; null when any name is allowed. */
function bodyNames(schema: BodySchema): string[] | null {
  if (schema.anyOf !== undefined) {
    const branches = schema.anyOf.map(bodyNames);
    return branches.includes(null) ? null : branches.flatMap((names) => names ?? []);
  }
  return schema.additionalProperties === true ? null : Object.keys(schema.properties ?? {});
}

/** The field names the contract gives each part of each operation's input; null is any name. */
const NAMES: ReadonlyMap<string, Readonly<Record<Part, ReadonlySet<string> | null>>> = new Map(
  OPERATIONS.map((op) => {
    const of = (where: string) => new Set((op.parameters ?? []).filter((p) => p.in === where).map((p) => p.name));
    const bodies = Object.values(op.requestBody?.content ?? {}).map((media) => bodyNames(media.schema));
    const body = bodies.includes(null) ? null : new Set(bodies.flatMap((names) => names ?? []));
    return [op.operationId, { params: of("path"), query: of("query"), body }] as const;
  }),
);

export type Input<Id extends OperationId> = Pick<Operations[Id], "params" | "query" | "body">;

/** Refused before the request was sent: the input breaks the contract. */
export type Rejected = { ok: false; status: 0; code: "client_rejected" };
export type ApiResult<Id extends OperationId> = Result<Id> | Rejected;

/** A plain copy of one part: getters run once, toJSON and prototypes do not travel. */
function snapshot(value: unknown): unknown {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value)) as unknown;
}

function onlyNamed(names: ReadonlySet<string> | null, value: unknown): boolean {
  return names === null || typeof value !== "object" || value === null || Object.keys(value).every((key) => names.has(key));
}

/**
 * True when a success answer is exactly what the contract declares for its
 * status. bodyBytes is the size of the body as received: the generated client
 * drops a body that is not JSON, so "no body" is checked on the wire.
 */
export function responseMatches(id: string, status: number, body: unknown, bodyBytes: number): boolean {
  const spec = RESPONSES.get(id)?.[String(status)];
  if (spec === undefined) return false;
  const schema = spec.content?.["application/json"]?.schema;
  if (schema === undefined) return body === undefined && bodyBytes === 0;
  return body !== undefined && matchesSchema(schema, body);
}

export type ApiOptions = {
  /** Origin of the API; the page's own origin by default. */
  readonly baseUrl?: string;
  /** Transport for tests; the browser's fetch by default. */
  readonly fetchImpl?: typeof fetch;
};

export function createApi(options: ApiOptions = {}) {
  const baseUrl = options.baseUrl ?? globalThis.location.origin;
  const transport: typeof fetch = options.fetchImpl ?? ((input, init) => fetch(input, init));
  return async function api<Id extends OperationId>(id: Id, input: Input<Id>): Promise<ApiResult<Id>> {
    const names = NAMES.get(id);
    let wire: Record<Part, unknown>;
    try {
      wire = { params: snapshot(input.params), query: snapshot(input.query), body: snapshot(input.body) };
    } catch {
      return { ok: false, status: 0, code: "client_rejected" };
    }
    if (names === undefined || !PARTS.every((part) => onlyNamed(names[part], wire[part]) && validateInput(id, part, wire[part]))) {
      return { ok: false, status: 0, code: "client_rejected" };
    }
    let bodyBytes = 0;
    const measured: typeof fetch = async (url, init) => {
      const res = await transport(url, init);
      bodyBytes = res.type === "opaqueredirect" ? 0 : (await res.clone().arrayBuffer()).byteLength;
      return res;
    };
    let result: Result<Id>;
    try {
      result = await createClient(baseUrl, measured)(id, wire as Input<Id>);
    } catch (error) {
      // A JSON content type with a body that is not JSON breaks the contract too.
      if (error instanceof SyntaxError) return { ok: false, status: 0, code: "unexpected" } as Result<Id>;
      throw error;
    }
    if (!result.ok) return result;
    const { status, body } = result as unknown as { status: number; body: unknown };
    return responseMatches(id, status, body, bodyBytes) ? result : ({ ok: false, status, code: "unexpected" } as Result<Id>);
  };
}
