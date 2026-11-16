// The schema check knows exactly the keywords the contract uses (DAN-752,
// POTVRDA UGOVORA w752a t. 2). A new contract version that uses another
// keyword or format fails here instead of being checked loosely.
import openapi from "@ductura/contracts/openapi/v1.json" with { type: "json" };
import { describe, expect, it } from "vitest";
import { matchesSchema, SUPPORTED_KEYWORDS, UnsupportedSchemaError, type Schema } from "./schema-check";

type Node = Record<string, unknown>;

/** Every schema object reachable from the response schemas of the contract. */
function responseSchemas(): Node[] {
  const found: Node[] = [];
  const walk = (schema: unknown): void => {
    if (typeof schema === "boolean") return;
    const s = schema as Node;
    found.push(s);
    for (const sub of Object.values((s.properties ?? {}) as Node)) walk(sub);
    if (typeof s.items === "object") walk(s.items);
    if (typeof s.additionalProperties === "object") walk(s.additionalProperties);
    for (const sub of Object.values((s.patternProperties ?? {}) as Node)) walk(sub);
    for (const sub of [...((s.anyOf ?? []) as unknown[]), ...((s.oneOf ?? []) as unknown[])]) walk(sub);
  };
  for (const methods of Object.values((openapi as unknown as { paths: Record<string, Record<string, Node>> }).paths)) {
    for (const op of Object.values(methods)) {
      for (const response of Object.values(op.responses as Record<string, Node>)) {
        for (const media of Object.values((response.content ?? {}) as Record<string, Node>)) walk(media.schema);
      }
    }
  }
  return found;
}

describe("schema check against the contract", () => {
  const schemas = responseSchemas();

  it("finds the response schemas", () => {
    expect(schemas.length).toBeGreaterThan(50);
  });

  it("supports every keyword the response schemas use", () => {
    const used = new Set(schemas.flatMap((s) => Object.keys(s)));
    expect([...used].filter((k) => !SUPPORTED_KEYWORDS.has(k))).toEqual([]);
  });

  it("supports every format and type, and compiles every pattern as unicode", () => {
    for (const s of schemas) {
      if (s.format !== undefined) expect(s.format).toBe("date-time");
      for (const t of [s.type].flat().filter((x) => x !== undefined)) {
        expect(["null", "boolean", "string", "number", "integer", "array", "object"]).toContain(t);
      }
      if (typeof s.pattern === "string") expect(() => new RegExp(s.pattern as string, "u")).not.toThrow();
    }
  });

  it("closes every object of a response except the ones the contract leaves open", () => {
    // 2.0.0: the live document snapshot (live.document.get 200) and the empty
    // anchor of a collaboration list item are open by contract; nothing else is.
    const open = schemas.filter((x) => (x.type === "object" || x.properties !== undefined) && x.additionalProperties !== false);
    expect([...new Set(open.map((s) => JSON.stringify(s)))].sort()).toEqual([
      JSON.stringify({ additionalProperties: true, type: "object", properties: {} }),
      JSON.stringify({ type: "object", properties: {} }),
    ]);
  });
});

describe("schema check rules", () => {
  it("throws on a keyword it does not know, so it never checks loosely", () => {
    expect(() => matchesSchema({ type: "string", enum: ["a"] }, "b")).toThrow(UnsupportedSchemaError);
    expect(() => matchesSchema({ $ref: "#/x" } as Schema, 1)).toThrow(UnsupportedSchemaError);
    expect(() => matchesSchema({ type: "string", format: "email" }, "a@b")).toThrow(UnsupportedSchemaError);
    expect(() => matchesSchema({ type: "decimal" }, 1)).toThrow(UnsupportedSchemaError);
    expect(() => matchesSchema({ allOf: [true] } as Schema, 1)).toThrow(UnsupportedSchemaError);
    expect(() => matchesSchema({ type: "array", uniqueItems: true }, [1])).toThrow(UnsupportedSchemaError);
  });

  it("checks minItems and maxItems on arrays only", () => {
    expect(matchesSchema({ type: "array", minItems: 1 }, [])).toBe(false);
    expect(matchesSchema({ type: "array", minItems: 1 }, ["a"])).toBe(true);
    expect(matchesSchema({ type: "array", maxItems: 256 }, Array.from({ length: 256 }, () => "a"))).toBe(true);
    expect(matchesSchema({ type: "array", maxItems: 256 }, Array.from({ length: 257 }, () => "a"))).toBe(false);
    expect(matchesSchema({ minItems: 1, maxItems: 0 }, "ab")).toBe(true);
    expect(matchesSchema({ minItems: 1 }, {})).toBe(true);
  });

  it("checks minProperties on objects only, counting own keys", () => {
    const schema = { type: "object", minProperties: 1, properties: { min: { type: "integer" } }, additionalProperties: false };
    expect(matchesSchema(schema, {})).toBe(false);
    expect(matchesSchema(schema, { min: 1 })).toBe(true);
    expect(matchesSchema(schema, Object.create({ min: 1 }) as object)).toBe(false);
    expect(matchesSchema({ minProperties: 1 }, [])).toBe(true);
    expect(matchesSchema({ minProperties: 1 }, "")).toBe(true);
  });

  it("checks patternProperties before additionalProperties", () => {
    const hex = "a".repeat(64);
    const schema = { type: "object", additionalProperties: false, patternProperties: { "^[0-9a-f]{64}$": { type: "string" } } };
    expect(matchesSchema(schema, {})).toBe(true);
    expect(matchesSchema(schema, { [hex]: "doc" })).toBe(true);
    expect(matchesSchema(schema, { [hex]: 1 })).toBe(false);
    const bad = ["A".repeat(64), "a".repeat(63), "a".repeat(65), `${hex}\n`, `${hex}\r\n`, `${hex}\t`, `${hex}\u00a0`, `${hex}\u007f`, "toString"];
    for (const key of bad) expect(matchesSchema(schema, { [key]: "doc" })).toBe(false);
    expect(matchesSchema(schema, JSON.parse('{"__proto__":"doc"}'))).toBe(false);
    const open = { type: "object", patternProperties: { "^a$": { type: "string" } } };
    expect(matchesSchema(open, { b: 1 })).toBe(true);
    expect(matchesSchema(open, { a: 1 })).toBe(false);
  });

  it("checks a key in properties against its pattern too", () => {
    const schema = { type: "object", properties: { ab: { type: "string" } }, patternProperties: { "^a": { maxLength: 1 } }, additionalProperties: false };
    expect(matchesSchema(schema, { ab: "x" })).toBe(true);
    expect(matchesSchema(schema, { ab: "xy" })).toBe(false);
    expect(matchesSchema(schema, { ab: 1 })).toBe(false);
  });

  it("checks types, integer and finite numbers", () => {
    expect(matchesSchema({ type: "integer" }, 1)).toBe(true);
    expect(matchesSchema({ type: "integer" }, 1.5)).toBe(false);
    expect(matchesSchema({ type: "number" }, Number.NaN)).toBe(false);
    expect(matchesSchema({ type: ["string", "null"] }, null)).toBe(true);
    expect(matchesSchema({ type: "object" }, [])).toBe(false);
  });

  it("checks oneOf as exactly one and anyOf as at least one", () => {
    const both = [{ type: "integer" }, { type: "number" }];
    expect(matchesSchema({ oneOf: both }, 1)).toBe(false);
    expect(matchesSchema({ anyOf: both }, 1)).toBe(true);
  });

  it("checks lengths in code points, bounds, const, required and date-time", () => {
    expect(matchesSchema({ type: "string", maxLength: 1 }, "😀")).toBe(true);
    expect(matchesSchema({ type: "integer", minimum: 0 }, -1)).toBe(false);
    expect(matchesSchema({ const: "ok" }, "OK")).toBe(false);
    expect(matchesSchema({ type: "object", required: ["a"], properties: { a: true } }, {})).toBe(false);
    expect(matchesSchema({ type: "string", format: "date-time" }, "2026-11-16T00:00:00Z")).toBe(true);
    expect(matchesSchema({ type: "string", format: "date-time" }, "2026-13-40T99:00:00Z")).toBe(false);
    expect(matchesSchema({ type: "string", format: "date-time" }, "yesterday")).toBe(false);
    for (const impossible of ["2026-02-31T00:00:00Z", "2026-02-30T24:00:00Z", "2026-04-31T00:00:00Z", "2026-01-01T00:60:00Z", "2026-01-01T00:00:00+24:00"]) {
      expect(matchesSchema({ type: "string", format: "date-time" }, impossible)).toBe(false);
    }
    // A leap second exists only at 23:59:60 UTC.
    for (const leap of ["2016-12-31T23:59:60Z", "2016-12-31T23:59:60.5Z", "2017-01-01T00:59:60+01:00", "2016-12-31T18:59:60-05:00"]) {
      expect(matchesSchema({ type: "string", format: "date-time" }, leap)).toBe(true);
    }
    for (const notLeap of ["2028-02-29T23:59:60.5+01:00", "2026-01-01T12:30:60Z", "2026-01-01T23:58:60Z", "2016-12-31T23:59:60-05:00"]) {
      expect(matchesSchema({ type: "string", format: "date-time" }, notLeap)).toBe(false);
    }
  });

  it("refuses an inherited or extra field when additionalProperties is false", () => {
    const schema = { type: "object", properties: { a: { type: "string" } }, additionalProperties: false };
    expect(matchesSchema(schema, { a: "x" })).toBe(true);
    expect(matchesSchema(schema, { a: "x", b: 1 })).toBe(false);
    expect(matchesSchema(schema, JSON.parse('{"a":"x","__proto__":{}}'))).toBe(false);
    expect(matchesSchema(schema, JSON.parse('{"a":"x","constructor":1}'))).toBe(false);
  });
});
