// A small JSON Schema check for the response schemas of openapi/v1.json in
// @ductura/contracts (DAN-752). Not Ajv: Ajv compiles with new Function, which a
// strict CSP without unsafe-eval forbids (POTVRDA UGOVORA w752a, t. 2).
// It knows only the keywords the contract uses. Any other keyword throws, so a
// new contract version that needs more fails the tests instead of passing.

export type Schema = boolean | { readonly [keyword: string]: unknown };

export const SUPPORTED_KEYWORDS: ReadonlySet<string> = new Set([
  "type",
  "const",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "anyOf",
  "oneOf",
  "pattern",
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "format",
  "description",
]);

const SUPPORTED_FORMATS: ReadonlySet<string> = new Set(["date-time"]);

export class UnsupportedSchemaError extends Error {}

const DATE_TIME = /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasType(type: string, value: unknown): boolean {
  switch (type) {
    case "null": return value === null;
    case "boolean": return typeof value === "boolean";
    case "string": return typeof value === "string";
    case "number": return typeof value === "number" && Number.isFinite(value);
    case "integer": return Number.isInteger(value);
    case "array": return Array.isArray(value);
    case "object": return isPlainObject(value);
    default: throw new UnsupportedSchemaError(`type ${type}`);
  }
}

function sameJson(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => sameJson(x, b[i]));
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((k) => Object.hasOwn(b, k) && sameJson(a[k], b[k]));
  }
  return a === b;
}

/** True when value is valid against schema. Throws UnsupportedSchemaError for an unknown keyword. */
export function matchesSchema(schema: Schema, value: unknown): boolean {
  if (typeof schema === "boolean") return schema;
  for (const keyword of Object.keys(schema)) {
    if (!SUPPORTED_KEYWORDS.has(keyword)) throw new UnsupportedSchemaError(`keyword ${keyword}`);
  }
  const s = schema as Record<string, unknown>;
  if (s.type !== undefined) {
    const types = Array.isArray(s.type) ? (s.type as string[]) : [s.type as string];
    if (!types.some((t) => hasType(t, value))) return false;
  }
  if (Object.hasOwn(s, "const") && !sameJson(s.const, value)) return false;
  if (s.anyOf !== undefined && !(s.anyOf as Schema[]).some((sub) => matchesSchema(sub, value))) return false;
  if (s.oneOf !== undefined && (s.oneOf as Schema[]).filter((sub) => matchesSchema(sub, value)).length !== 1) return false;
  if (typeof value === "string") {
    const length = [...value].length;
    if (typeof s.minLength === "number" && length < s.minLength) return false;
    if (typeof s.maxLength === "number" && length > s.maxLength) return false;
    if (typeof s.pattern === "string" && !new RegExp(s.pattern, "u").test(value)) return false;
    if (s.format !== undefined) {
      if (!SUPPORTED_FORMATS.has(s.format as string)) throw new UnsupportedSchemaError(`format ${String(s.format)}`);
      if (!DATE_TIME.test(value) || Number.isNaN(Date.parse(value))) return false;
    }
  }
  if (typeof value === "number") {
    if (typeof s.minimum === "number" && value < s.minimum) return false;
    if (typeof s.maximum === "number" && value > s.maximum) return false;
  }
  if (Array.isArray(value) && s.items !== undefined) {
    if (!value.every((item) => matchesSchema(s.items as Schema, item))) return false;
  }
  if (isPlainObject(value)) {
    const properties = (s.properties ?? {}) as Record<string, Schema>;
    for (const name of (s.required ?? []) as string[]) if (!Object.hasOwn(value, name)) return false;
    for (const name of Object.keys(value)) {
      const sub = Object.hasOwn(properties, name) ? properties[name] : (s.additionalProperties as Schema | undefined);
      if (sub !== undefined && !matchesSchema(sub, value[name])) return false;
    }
  }
  return true;
}
