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
import catalog from "@ductura/contracts/errors/catalog.json" with { type: "json" };
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

type CatalogEntry = { readonly status: number; readonly code: string; readonly messageKey: string };

/**
 * DAN-1062: the one session_expired entry of the error catalogue (a 401 told
 * apart from unauthenticated by its code). Throws when the catalogue lost it,
 * has it twice or gives it another status, so the client never guesses. Other
 * 401 entries (unauthenticated) are the catalogue's own and do not matter here.
 */
export function sessionExpiredEntry(source: { readonly errors: readonly CatalogEntry[] }): CatalogEntry {
  const found = source.errors.filter((entry) => entry.code === "session_expired");
  if (found.length !== 1 || found[0]?.status !== 401) throw new Error("error catalogue: no single 401 session_expired");
  const { status, code, messageKey } = found[0];
  return { status, code, messageKey };
}
export const SESSION_EXPIRED_ENTRY = sessionExpiredEntry(catalog);

type Paths = Readonly<Record<string, Readonly<Record<string, Operation>>>>;
export type LoginRoute = { readonly path: string; readonly param: string };

/**
 * DAN-1081: the login route (auth.login.get) and its returnTo query, read from
 * the contract, never written by hand. Throws when the contract has no single
 * GET auth.login.get on a local path or no returnTo query, so a link is never
 * guessed.
 */
export function loginRoute(paths: Paths): LoginRoute {
  const found = Object.entries(paths).filter(([, methods]) => methods.get?.operationId === "auth.login.get");
  const [path, methods] = found[0] ?? [];
  const param = (methods?.get?.parameters ?? []).find((p) => p.in === "query" && p.name === "returnTo")?.name;
  if (found.length !== 1 || path === undefined || !path.startsWith("/") || path.startsWith("//") || param === undefined) {
    throw new Error("contract: no single GET auth.login.get with a returnTo query");
  }
  return { path, param };
}
export const LOGIN_ROUTE = loginRoute((openapi as unknown as { paths: Paths }).paths);

// The server's rule for returnTo (ductura/Institution_server server/session/return-to.ts),
// copied, never widened: the server checks it again, this only keeps the link
// from carrying what the server would discard.
const RETURN_TO_MAX = 512;
const RETURN_TO_BASE = "https://ductura.invalid";
// C0 and C1 controls, line and paragraph separators, invisible format characters and lone surrogates.
const RETURN_TO_UNSAFE = /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u;
const RETURN_TO_DECODE_ROUNDS = 3;

/** True for /api and below in any case or percent-encoding, up to three rounds deep; undecodable counts too. */
function isApiPath(pathname: string): boolean {
  let path = pathname;
  for (let round = 0; round <= RETURN_TO_DECODE_ROUNDS; round += 1) {
    const lower = path.toLowerCase();
    if (lower === "/api" || lower.startsWith("/api/")) return true;
    let decoded: string;
    try {
      decoded = decodeURIComponent(path);
    } catch {
      return true;
    }
    if (decoded === path) return false;
    path = decoded;
  }
  return true;
}

/** The path the server would return to after login, as the server would normalise it; null when it would fall back. */
export function signInReturnTo(value: unknown): string | null {
  try {
    if (typeof value !== "string" || value.length === 0 || value.length > RETURN_TO_MAX) return null;
    // "//host" and "/\host" are protocol-relative in browsers.
    if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || RETURN_TO_UNSAFE.test(value)) return null;
    const parsed = new URL(value, RETURN_TO_BASE);
    if (parsed.origin !== RETURN_TO_BASE || isApiPath(parsed.pathname)) return null;
    // Dot segments are removed by the parser ("/.//host" becomes "//host"), so the result is checked again.
    const result = parsed.pathname + parsed.search + parsed.hash;
    return result.startsWith("//") || result.startsWith("/\\") ? null : result;
  } catch {
    return null;
  }
}

/**
 * DAN-1081: the same-origin link that starts AAI@EduHr login. returnTo goes in
 * only when the server's rule keeps it; anything else gives the plain login
 * link. Never throws.
 */
export function signInHref(returnTo?: unknown): string {
  const target = signInReturnTo(returnTo);
  if (target === null || typeof returnTo !== "string") return LOGIN_ROUTE.path;
  // Normalising percent-encodes ("č" becomes six characters), so the target can
  // outgrow the limit the server checks before it normalises. The input as given
  // is within that limit and the server normalises it to the same target.
  const sent = target.length <= RETURN_TO_MAX && signInReturnTo(target) === target ? target : returnTo;
  return `${LOGIN_ROUTE.path}?${LOGIN_ROUTE.param}=${encodeURIComponent(sent)}`;
}

/** No route of the contract lists session_expired yet (S-1D-d); the client keeps it on routes with a 401, auth.* aside. */
export type SessionExpired = { ok: false; status: 401; code: "session_expired" };

/** The code a JSON error body sends: the first string of code, error, status, as the generated client reads it. */
function sentCode(bytes: ArrayBuffer): string | undefined {
  try {
    const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof body !== "object" || body === null) return undefined;
    // Own fields only: a string on a prototype never stands in for the body's own code.
    const own = (name: string): unknown => (Object.hasOwn(body, name) ? (body as Record<string, unknown>)[name] : undefined);
    return [own("code"), own("error"), own("status")].find((value): value is string => typeof value === "string");
  } catch {
    return undefined;
  }
}

export type Input<Id extends OperationId> = Pick<Operations[Id], "params" | "query" | "body">;

/** Refused before the request was sent: the input breaks the contract. */
export type Rejected = { ok: false; status: 0; code: "client_rejected" };
export type ApiResult<Id extends OperationId> = Result<Id> | Rejected | SessionExpired;

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
    let code: string | undefined;
    const measured: typeof fetch = async (url, init) => {
      const res = await transport(url, init);
      const bytes = res.type === "opaqueredirect" ? new ArrayBuffer(0) : await res.clone().arrayBuffer();
      bodyBytes = bytes.byteLength;
      // The same content type test as the generated client: only a body it reads as JSON.
      if (res.status === SESSION_EXPIRED_ENTRY.status && res.headers.get("content-type")?.startsWith("application/json")) code = sentCode(bytes);
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
    if (!result.ok) {
      const expired = result.status === SESSION_EXPIRED_ENTRY.status && result.code === "unexpected"
        && code === SESSION_EXPIRED_ENTRY.code && RESPONSES.get(id)?.["401"] !== undefined && !id.startsWith("auth.");
      return expired ? { ok: false, status: 401, code: "session_expired" } : result;
    }
    const { status, body } = result as unknown as { status: number; body: unknown };
    return responseMatches(id, status, body, bodyBytes) ? result : ({ ok: false, status, code: "unexpected" } as Result<Id>);
  };
}

// ---------------------------------------------------------------------------
// Session of the institution front (contract #2028 c.6993786629 §3.3).
// GET /api/v1/me is not in @ductura/contracts 2.8.0 yet: Institution_server
// adds it (w1111a), and until the contract names it, it is read here by hand,
// the one file that may call the API. Its answer is read field by field and
// unknown fields are ignored, so a wider answer never breaks the shell.

/** The session route of the institution server (same origin). */
export const SESSION_PATH = "/api/v1/me";

/** Account kinds that sign in at an institution (Institution_server server/roles/account-kinds.ts). */
export const SESSION_ROLES = ["student", "teacher", "institution_admin", "network_engineer"] as const;
export type SessionRole = (typeof SESSION_ROLES)[number];

export type Session = {
  /** The role the shell shows: institution_admin, then teacher, then student, then any other; null without one. */
  readonly role: SessionRole | null;
  readonly roles: readonly SessionRole[];
  readonly displayName: string | null;
  /** The institution's display name, shown in the shell. */
  readonly institution: string | null;
};

export type SessionRead =
  | { readonly kind: "signedIn"; readonly session: Session }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

const ROLE_ORDER: readonly SessionRole[] = ["institution_admin", "teacher", "student", "network_engineer"];
const ROLE_ALIASES: Readonly<Record<string, SessionRole>> = { admin: "institution_admin" };

function asRole(value: unknown): SessionRole | null {
  if (typeof value !== "string") return null;
  const role = ROLE_ALIASES[value] ?? value;
  return (SESSION_ROLES as readonly string[]).includes(role) ? (role as SessionRole) : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** The session from a 200 body of GET /api/v1/me; null when the body is not an object. Own fields only. */
export function parseSession(body: unknown): Session | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const own = (from: object, name: string): unknown => (Object.hasOwn(from, name) ? (from as Record<string, unknown>)[name] : undefined);
  const listed = own(body, "roles");
  const found = new Set<SessionRole>();
  const single = asRole(own(body, "role"));
  if (single !== null) found.add(single);
  if (Array.isArray(listed)) for (const item of listed) {
    const role = asRole(item);
    if (role !== null) found.add(role);
  }
  const roles = ROLE_ORDER.filter((role) => found.has(role));
  const institution = own(body, "institution");
  const institutionName = typeof institution === "object" && institution !== null
    ? text(own(institution, "displayName")) ?? text(own(institution, "name"))
    : text(institution);
  return {
    role: roles[0] ?? null,
    roles,
    displayName: text(own(body, "displayName")),
    institution: institutionName ?? text(own(body, "institutionName")),
  };
}

/**
 * One read of the session: 200 with a JSON object is signed in, 401 signed
 * out, anything else (a broken connection included) unavailable. Same origin,
 * with the session cookie.
 */
export async function readSession(options: ApiOptions = {}): Promise<SessionRead> {
  const baseUrl = options.baseUrl ?? globalThis.location.origin;
  const transport: typeof fetch = options.fetchImpl ?? ((input, init) => fetch(input, init));
  try {
    const res = await transport(new URL(SESSION_PATH, baseUrl), {
      method: "GET",
      credentials: "include",
      redirect: "manual",
      headers: { accept: "application/json" },
    });
    if (res.status === 401) return { kind: "signedOut" };
    if (res.status !== 200 || !res.headers.get("content-type")?.startsWith("application/json")) return { kind: "unavailable" };
    const session = parseSession(await res.json());
    return session === null ? { kind: "unavailable" } : { kind: "signedIn", session };
  } catch {
    return { kind: "unavailable" };
  }
}

/** Leaves the app for an address of the same origin. The only navigation out of the app. */
export function leaveFor(href: string): void {
  globalThis.location.assign(href);
}

/** Sends the browser to AAI@EduHr sign-in, returning to `here` (the app's own path) afterwards. */
export function goToSignIn(here: string, leave: (href: string) => void = leaveFor): void {
  leave(signInHref(here));
}

/**
 * Signs out through auth.logout.post (303 on success). True when the server
 * ended the session; the caller then leaves for the preloader.
 */
export async function signOut(options: ApiOptions = {}): Promise<boolean> {
  try {
    const result = await createApi(options)("auth.logout.post", { params: undefined, query: undefined, body: undefined } as Input<"auth.logout.post">);
    return result.ok;
  } catch {
    return false;
  }
}
