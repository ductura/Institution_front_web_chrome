// The client's reader against every vector of migration-contract-vectors.generated.json (ZEL-W19).
// When the server changes a contract, the extract and its vectors are regenerated and this file fails in
// CI before the merge, not in the app. For each vector with a JSON answer the reader (createApi in api.ts,
// answer, refuse a field of the wrong type and refuse an answer that lacks a required field.
import { describe, expect, it } from "vitest";
import { createApi, RESPONSES, type ApiOperationId, type Input } from "./api";
import vectors from "./migration-contract-vectors.generated.json" with { type: "json" };

const BASE_URL = "https://ductura.example.invalid";
type Vector = (typeof vectors)[number];
type Json = Record<string, unknown>;

function answering(status: number, body: unknown, contentType: string): typeof fetch {
  return async () => new Response(JSON.stringify(body), { status, headers: { "content-type": contentType } });
}

function inputOf(vector: Vector): Input<ApiOperationId> {
  const { params, query, body } = vector.request as { params?: unknown; query?: unknown; body?: unknown };
  return { params, query, body } as Input<ApiOperationId>;
}

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A value of another JSON type than the given one. */
function otherType(value: unknown): unknown {
  return typeof value === "string" ? 12345 : { wrong: true };
}

function schemaOf(vector: Vector): Json | undefined {
  const spec = RESPONSES.get(vector.route)?.[String(vector.response.status)];
  return spec?.content?.["application/json"]?.schema as Json | undefined;
}

const multipart = (v: Vector) => (v.request as { headers?: Record<string, string> }).headers?.["content-type"]?.startsWith("multipart/") === true;
const successes = vectors.filter((v) => v.response.status < 400 && (v.response as { contentType?: string }).contentType?.startsWith("application/json") === true);

describe("client reader against the migration vectors", () => {
  it("has vectors to read", () => {
    expect(successes.length).toBeGreaterThan(0);
  });

  for (const vector of successes) {
    const id = vector.route as ApiOperationId;
    const { status, body } = vector.response;
    const contentType = (vector.response as { contentType?: string }).contentType ?? "application/json";
    const read = (answer: unknown) => createApi({ baseUrl: BASE_URL, fetchImpl: answering(status, answer, contentType) })(id, inputOf(vector));

    // A multipart upload (the source proof image) is no JSON body: this client does not send it, so there is no answer to read.
    if (multipart(vector)) {
      it(`${id} ${vector.name}: is a multipart upload the client refuses before sending`, async () => {
        expect(await read(body)).toEqual({ ok: false, status: 0, code: "client_rejected" });
      });
      continue;
    }

    it(`${id} ${vector.name}: accepts the valid answer`, async () => {
      expect(await read(body)).toEqual({ ok: true, status, body, headers: {} });
    });

    if (isObject(body)) {
      it(`${id} ${vector.name}: refuses a wrong type and a missing required field`, async () => {
        const schema = schemaOf(vector);
        const properties = isObject(schema?.properties) ? schema.properties : {};
        const required = Array.isArray(schema?.required) ? (schema.required as string[]) : [];
        for (const key of Object.keys(body)) {
          if (key in properties && isObject(properties[key]) && ("type" in properties[key] || "const" in properties[key])) {
            expect(await read({ ...body, [key]: otherType(body[key]) }), `${key} of the wrong type`).toEqual({ ok: false, status, code: "unexpected" });
          }
        }
        for (const key of required) {
          if (!(key in body)) continue;
          const { [key]: _removed, ...rest } = body;
          expect(await read(rest), `${key} missing`).toEqual({ ok: false, status, code: "unexpected" });
        }
      });
    }
  }

  it("refuses an answer that is not an object where the contract gives one", async () => {
    for (const vector of successes.filter((v) => !multipart(v) && isObject(v.response.body) && schemaOf(v)?.type === "object")) {
      const { status } = vector.response;
      const contentType = (vector.response as { contentType?: string }).contentType ?? "application/json";
      const result = await createApi({ baseUrl: BASE_URL, fetchImpl: answering(status, "nope", contentType) })(vector.route as ApiOperationId, inputOf(vector));
      expect(result, `${vector.route} ${vector.name}`).toEqual({ ok: false, status, code: "unexpected" });
    }
  });
});
