import openapi from "@ductura/contracts/openapi/v1.json" with { type: "json" };
import { validateInput, type OperationId } from "@ductura/contracts";
import { describe, expect, it, vi } from "vitest";
import { AHEAD_OF_PACKAGE, createApi, RESPONSES, type ApiOperationId, type Input } from "./api";
import contracts from "./migration-contracts.generated.json" with { type: "json" };
import vectors from "./migration-contract-vectors.generated.json" with { type: "json" };
import { matchesSchema, type Schema } from "./schema-check";

const BASE_URL = "https://ductura.example.invalid";
type Vector = (typeof vectors)[number];

/** Statuses a Response cannot carry a body with (204 from the WEB-2133B deletes). */
const NULL_BODY_STATUS = new Set([204, 205, 304]);
/** Input errors: a vector whose request the client's own check refuses is never sent (WEB-2133B PUT vectors). */
const INPUT_ERROR_STATUS = new Set([400, 408, 413, 415, 422]);
/** A response the contract declares as bytes, not JSON (the JPEG proof image): the client reads no body. */
const binary = (vector: Vector) => vector.response.contentType !== undefined && !vector.response.contentType.startsWith("application/json")
  && vector.response.status < 300 && vector.response.body !== undefined;

type ContractRoute = { params?: Schema; query?: Schema; body?: Schema; responses: Record<string, unknown>; errors: Record<string, string[]> };
const route = (vector: Vector) => (contracts as unknown as Record<string, ContractRoute>)[vector.route]!;

/** A status the contract declares as an answer (a 409 with a body) is read as one, whatever its number. */
const declaredAnswer = (vector: Vector) => RESPONSES.get(vector.route)?.[String(vector.response.status)] !== undefined
  && sentCode(vector) === undefined && typeof vector.response.body === "object";

/**
 * The code the client reads from an error vector. The server names its code in the body ("code", or "error",
 * or a "status" word in the oldest vectors); a code the contract declares for the status is read as sent, any
 * other as "unexpected", except the shared 429 and 500 codes. A body that names none gives the vector name,
 * as the original vectors do. The extract's vector names are scenarios ("cross-site"), not codes.
 */
function sentCode(vector: Vector): string | undefined {
  const body = vector.response.body as Record<string, unknown> | string | undefined;
  const fields = typeof body === "object" && body !== null ? body : {};
  return [fields.code, fields.error, fields.status].find((value) => typeof value === "string") as string | undefined;
}

function expectedCode(vector: Vector): string {
  const { status } = vector.response;
  const sent = sentCode(vector);
  if (sent === undefined) return vector.name.replaceAll("-", "_");
  if ((status === 429 && sent === "too_many_requests") || (status === 500 && sent === "internal")) return sent;
  // Declared by the extract's list for the status, or by the package's schema for it (the extract's list of a
  // published operation can be a description sentence, as for the 409 of a revision request).
  const schema = RESPONSES.get(vector.route)?.[String(status)]?.content?.["application/json"]?.schema;
  const declared = (route(vector).errors[String(status)] ?? []).includes(sent) || (schema !== undefined && matchesSchema(schema, vector.response.body));
  return declared ? sent : "unexpected";
}

/** A vector request the client cannot form: raw bytes, a missing body the contract requires, or a part off its schema. */
function unformable(vector: Vector): boolean {
  const request = vector.request as { params?: unknown; query?: unknown; body?: unknown; rawBody?: unknown };
  if (request.rawBody !== undefined) return true;
  // The published package is behind the server on some inputs (access-log and login with no query): what it
  // refuses, api refuses before sending (contract-vectors.test.ts pins that), whatever the extract says.
  if (published.has(vector.route) && !(["params", "query", "body"] as const)
    .every((part) => validateInput(vector.route as OperationId, part, inputFor(vector)[part as keyof Input<ApiOperationId>]))
    && !AHEAD_OF_PACKAGE.has(vector.route)) return true;
  // A multipart upload (the source proof image) is not a JSON body: this client does not send it.
  if ((vector.request as { headers?: Record<string, string> }).headers?.["content-type"]?.startsWith("multipart/")) return true;
  return (["params", "query", "body"] as const).some((part) => {
    const schema = route(vector)[part];
    const value = part === "query" && !hasQuery(vector) ? undefined : request[part];
    return schema === undefined ? value !== undefined : !matchesSchema(schema, value === undefined ? (part === "body" ? undefined : {}) : value);
  });
}

/** The contract closes the answer's object (an extra field is refused); the live snapshot and empty anchors are open by contract. */
function closedAnswer(vector: Vector): boolean {
  const schema = RESPONSES.get(vector.route)?.[String(vector.response.status)]?.content?.["application/json"]?.schema;
  const body = vector.response.body as Record<string, unknown>;
  return schema !== undefined && matchesSchema(schema, body) && !matchesSchema(schema, { ...body, unexpectedField: true });
}

/** The operation ids the published package has: a vector of any other is read by the extract's route only. */
const published = new Set(Object.values(openapi.paths as Record<string, Record<string, { operationId: string }>>)
  .flatMap((methods) => Object.values(methods).map((operation) => operation.operationId)));

function hasQuery(vector: Vector): boolean {
  return "query" in (contracts as Record<string, object>)[vector.route]!;
}

function responding(vector: Vector, body: unknown = vector.response.body) {
  return vi.fn(async (_url: URL | RequestInfo, _init?: RequestInit) =>
    new Response(NULL_BODY_STATUS.has(vector.response.status) ? null : JSON.stringify(body), {
      status: vector.response.status,
      headers: { "content-type": vector.response.contentType },
    }));
}

function inputFor(vector: Vector) {
  const { params, body } = vector.request;
  // A query is sent only for an operation whose contract has a query schema (WEB-2007); the others take none.
  const hasQuery = "query" in (contracts as Record<string, object>)[vector.route]!;
  const query = hasQuery && "query" in vector.request ? vector.request.query : undefined;
  return { params, query, body } as Input<ApiOperationId>;
}

describe("WEB-07 temporary API contracts", () => {
  for (const vector of vectors) {
    const id = vector.route as ApiOperationId;

    it(`${id} ${vector.name} reads the canonical response`, async () => {
      const fetchImpl = responding(vector);
      const api = createApi({ baseUrl: BASE_URL, fetchImpl });
      const { status, body } = vector.response;
      const result = await api(id, inputFor(vector));

      if ((INPUT_ERROR_STATUS.has(status) || unformable(vector)) && "code" in result && result.code === "client_rejected") {
        // The body is raw bytes (rawBody), is missing, or breaks the request schema: refused before the network.
        expect(unformable(vector) || INPUT_ERROR_STATUS.has(status)).toBe(true);
        expect(fetchImpl).not.toHaveBeenCalled();
        return;
      }
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      if (status < 400 || declaredAnswer(vector)) expect(result).toEqual({ ok: true, status, body: binary(vector) ? undefined : body, headers: {} });
      else expect(result).toEqual({ ok: false, status, code: expectedCode(vector) });
    });

    if ((vector.response.status < 400 || declaredAnswer(vector)) && !NULL_BODY_STATUS.has(vector.response.status) && !binary(vector)
      && !unformable(vector) && closedAnswer(vector)) {
      it(`${id} ${vector.name} rejects undeclared response fields`, async () => {
        const fetchImpl = responding(vector, { ...vector.response.body, unexpectedField: true });
        const api = createApi({ baseUrl: BASE_URL, fetchImpl });
        expect(await api(id, inputFor(vector))).toEqual({ ok: false, status: vector.response.status, code: "unexpected" });
      });
    }
  }

  it("rejects extra fields inside student assignments", async () => {
    const vector = vectors.find((item) => item.route === "student.assignments.get" && item.name === "ready")!;
    const body = structuredClone(vector.response.body) as { courses: { assignments: Record<string, unknown>[] }[] };
    body.courses[0]!.assignments[0]!.unexpectedField = true;
    const api = createApi({ baseUrl: BASE_URL, fetchImpl: responding(vector, body) });
    expect(await api("student.assignments.get", { params: undefined, query: undefined, body: undefined }))
      .toEqual({ ok: false, status: 200, code: "unexpected" });
  });

  it("rejects unknown enrollment fields before sending", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const api = createApi({ baseUrl: BASE_URL, fetchImpl });
    const body = { code: "IZMISLJENI-KOD-0001", unexpectedField: true };
    const result = await api("student.enrollments.post", { params: undefined, query: undefined, body });
    expect(result).toEqual({ ok: false, status: 0, code: "client_rejected" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends the assignment request key in the closed JSON body on the course route", async () => {
    const vector = vectors.find((item) => item.route === "institution.course-assignments.post" && item.name === "created")!;
    const fetchImpl = responding(vector);
    const api = createApi({ baseUrl: BASE_URL, fetchImpl });
    await api("institution.course-assignments.post", inputFor(vector) as Input<"institution.course-assignments.post">);

    const [url, init] = fetchImpl.mock.calls[0]!;
    const { params, body } = vector.request;
    expect(String(url)).toBe(`${BASE_URL}/api/v1/institution/courses/${params?.courseId}/assignments`);
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual(body);
  });
});
