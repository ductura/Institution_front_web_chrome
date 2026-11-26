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
// The evidence routes read a ductus-protocol header that the contract's
// RequestSpec does not carry yet: createApi sends it for those routes only,
// when the caller names the protocol (ApiOptions.protocol, README.md).
// no-direct-api.test.ts keeps every other call out of the code.
import { canonicalJson, createClient, validateInput, type OperationId, type Operations, type SharedErrorCode } from "@ductura/contracts";
import openapi from "@ductura/contracts/openapi/v1.json" with { type: "json" };
import catalog from "@ductura/contracts/errors/catalog.json" with { type: "json" };
import migrationContracts from "./migration-contracts.generated.json" with { type: "json" };
import type { MigrationOperations } from "./migration-contract-types.generated";
import { matchesSchema, type Schema } from "./schema-check";

// A binary answer (a file download) names only its description and headers; with no content schema the body
// is read as no JSON at all, exactly as before (WEB-2004A).
type ResponseSpec = {
  readonly description?: string;
  readonly headers?: Readonly<Record<string, unknown>>;
  readonly content?: Readonly<Record<string, { readonly schema?: Schema }>>;
};
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

type MigrationRoute = {
  readonly path: string;
  readonly method: string;
  readonly params?: Schema;
  /** Only an operation whose contract has a query schema takes a query (WEB-2007). */
  readonly query?: Schema;
  readonly body?: Schema;
  readonly responses: Readonly<Record<string, ResponseSpec>>;
  readonly errors: Readonly<Record<string, readonly string[]>>;
};

// WEB-07: remove this supplement once the published package includes these operations.
const MIGRATION_ROUTES: ReadonlyMap<string, MigrationRoute> = new Map(Object.entries(migrationContracts));
const responses = new Map(OPERATIONS.map((op) => [op.operationId, op.responses] as const));
for (const [id, route] of MIGRATION_ROUTES) {
  responses.set(id, { ...responses.get(id), ...route.responses });
}

/** Responses of every operation of the contract, by operationId, then status. */
export const RESPONSES: ReadonlyMap<string, Readonly<Record<string, ResponseSpec>>> = responses;

/**
 * Operations the server's extract is ahead of the published package on, where the package refuses an input the server
 * takes (a general comment, anchor null; access-log and login with no query). Their refused inputs go by the extract's route; remove with the package bump.
 */
/** True when the extract's route for the operation takes this input (the package may refuse it). */
export function acceptedByExtract(id: string, input: { readonly params?: unknown; readonly query?: unknown; readonly body?: unknown }): boolean {
  const route = MIGRATION_ROUTES.get(id);
  return route !== undefined && acceptsPart(route.query, input.query) && acceptsPart(route.params, input.params) && acceptsPart(route.body, input.body);
}

export const AHEAD_OF_PACKAGE: ReadonlySet<string> = new Set(["collaboration.comments.post", "student.access-log.get", "auth.login.get"]);

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
function codeFromBody(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const own = (name: string): unknown => (Object.hasOwn(body, name) ? (body as Record<string, unknown>)[name] : undefined);
  return [own("code"), own("error"), own("status")].find((value): value is string => typeof value === "string");
}

function sentCode(bytes: ArrayBuffer): string | undefined {
  try {
    return codeFromBody(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return undefined;
  }
}

type ApiOperations = Omit<Operations, keyof MigrationOperations> & MigrationOperations;
export type ApiOperationId = keyof ApiOperations;
export type Input<Id extends ApiOperationId> = Pick<ApiOperations[Id], "params" | "query" | "body">;
type WireInput = Record<Part, unknown>;

/** Refused before the request was sent: the input breaks the contract. */
export type Rejected = { ok: false; status: 0; code: "client_rejected" };
export type ApiResult<Id extends ApiOperationId> =
  | (ApiOperations[Id]["success"] & { ok: true })
  | { ok: false; status: number; code: ApiOperations[Id]["errorCode"] | SharedErrorCode | "unexpected" }
  | Rejected
  | SessionExpired;

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
  // A declared non-JSON body (the JPEG proof image, WEB-2133B) is bytes the client does not read.
  const bytes = Object.keys(spec.content ?? {}).some((type) => type !== "application/json");
  if (schema === undefined) return body === undefined && (bytes || bodyBytes === 0);
  return body !== undefined && matchesSchema(schema, body);
}

/**
 * The routes whose server reads `ductus-protocol` (the contract's summaries:
 * evidence open, commit and replay, the submission and the live read). The contract's
 * RequestSpec names no request headers yet, so the list is written here and
 * closed; protocol.test.ts checks it against the vectors' headers.
 */
export const PROTOCOL_ROUTES: ReadonlySet<string> = new Set([
  "evidence.open.post", "evidence.commit.post", "evidence.replay.post", "submission.submit.post", "live.document.get",
]);
export type ProtocolVersion = "1" | "2";

/**
 * Migration routes whose server reads `ductus-protocol` (their vectors send it). With
 * ApiOptions.protocol such a route sends the header and an error keeps its JSON body as sent
 * (`errorBody`): the extract declares no error schema, so the caller checks its shape
 * (PIL-K-IZJAVA-VRATA, submission.ts). Closed; any other migration route is unchanged.
 */
export const MIGRATION_PROTOCOL_ROUTES: ReadonlySet<string> = new Set(["submission.submit-second.post"]);

/** The error body when it is exactly one the contract declares for the status; else undefined. */
function declaredError(id: string, status: number, bytes: ArrayBuffer): unknown {
  const schema = RESPONSES.get(id)?.[String(status)]?.content?.["application/json"]?.schema;
  if (schema === undefined) return undefined;
  try {
    const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return matchesSchema(schema, body) ? body : undefined;
  } catch {
    return undefined;
  }
}

export type ApiOptions = {
  /** Origin of the API; the page's own origin by default. */
  readonly baseUrl?: string;
  /** Transport for tests; the browser's fetch by default. */
  readonly fetchImpl?: typeof fetch;
  /**
   * `ductus-protocol` for a route of PROTOCOL_ROUTES; ignored for any other.
   * With it, an error of that route also keeps its body (`errorBody`) when the
   * body is exactly one the contract declares for its status: a 409 stale_base
   * carries the work's state. Without it nothing changes.
   */
  readonly protocol?: ProtocolVersion;
};

/** The body an error of a protocol route kept (ApiOptions.protocol); undefined for anything else. */
export function errorBody(result: { readonly ok: boolean }): unknown {
  return !result.ok && Object.hasOwn(result, "body") ? (result as { body?: unknown }).body : undefined;
}

function isEmptyObject(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).length === 0;
}

function acceptsPart(schema: Schema | undefined, part: unknown): boolean {
  // No schema: no part, or an empty query where the generated types ask for an object (institution.retention.get).
  if (schema === undefined) return part === undefined || (isEmptyObject(part));
  // An absent part is an empty object for a schema that requires nothing (a query with only optional names).
  return matchesSchema(schema, part === undefined ? {} : part);
}

function migrationError(route: MigrationRoute, status: number, body: unknown): string {
  const sent = codeFromBody(body);
  const codes = route.errors[String(status)] ?? [];
  if (sent === undefined) return codes.length === 1 ? codes[0] ?? "unexpected" : "unexpected";
  if (status === 401 && codes.length > 0 && sent === SESSION_EXPIRED_ENTRY.code) return sent;
  if ((status === 429 && sent === "too_many_requests") || (status === 500 && sent === "internal")) return sent;
  return codes.includes(sent) ? sent : "unexpected";
}

async function callMigrationRoute<Id extends ApiOperationId>(
  id: Id, route: MigrationRoute, wire: WireInput, baseUrl: string, transport: typeof fetch, protocol?: ProtocolVersion,
): Promise<ApiResult<Id>> {
  if (!acceptsPart(route.query, wire.query) || !acceptsPart(route.params, wire.params) || !acceptsPart(route.body, wire.body)) {
    return { ok: false, status: 0, code: "client_rejected" };
  }
  let requestBody: string | undefined;
  if (route.body !== undefined) {
    try {
      requestBody = canonicalJson(wire.body);
    } catch {
      return { ok: false, status: 0, code: "client_rejected" };
    }
  }
  const params = wire.params as Record<string, string> | undefined;
  const path = route.path.replace(/\{(\w+)\}/g, (_, name: string) => encodeURIComponent(params?.[name] ?? ""));
  const url = new URL(path, baseUrl);
  if (route.query !== undefined && wire.query !== undefined) {
    // acceptsPart checked the query against the schema above: an object of string values named by the contract.
    for (const [name, value] of Object.entries(wire.query as Record<string, string>)) url.searchParams.set(name, value);
  }
  const headers: Record<string, string> = {
    ...(requestBody === undefined ? {} : { "content-type": "application/json" }),
    ...(protocol === undefined ? {} : { "ductus-protocol": protocol }),
  };
  const response = await transport(url, {
    method: route.method,
    redirect: "manual",
    headers: Object.keys(headers).length === 0 ? undefined : headers,
    body: requestBody,
  });
  const status = response.status;
  const bytes = await response.arrayBuffer();
  let body: unknown;
  if (response.headers.get("content-type")?.startsWith("application/json")) {
    try {
      body = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return { ok: false, status: unreadableStatus(status), code: "unexpected" };
    }
  }
  if (status >= 400) {
    const error = { ok: false, status, code: migrationError(route, status, body) };
    const kept = protocol !== undefined && typeof body === "object" && body !== null && !Array.isArray(body);
    return (kept ? { ...error, body } : error) as ApiResult<Id>;
  }
  if (!responseMatches(id, status, body, bytes.byteLength)) return { ok: false, status, code: "unexpected" };
  return { ok: true, status, body, headers: {} } as ApiResult<Id>;
}

/**
 * The status of an answer declared JSON whose body is not JSON. A 5xx keeps its
 * own status (WEB-ER, Ductus#2028 c.7020060555): the server or a proxy did not
 * finish, so a caller may send the same request again, as for any other 5xx.
 * Anything else is 0: an unreadable success never confirms anything, and an
 * unreadable 4xx is not the refusal its status names.
 */
function unreadableStatus(status: number): number {
  return status >= 500 && status <= 599 ? status : 0;
}

/** The browser's own transport, for a caller that wraps it before handing it to createApi (WEB-38). */
export const browserTransport: typeof fetch = (input, init) => fetch(input, init);

export function createApi(options: ApiOptions = {}) {
  const baseUrl = options.baseUrl ?? globalThis.location.origin;
  const transport: typeof fetch = options.fetchImpl ?? browserTransport;
  return async function api<Id extends ApiOperationId>(id: Id, input: Input<Id>): Promise<ApiResult<Id>> {
    const names = NAMES.get(id);
    let wire: WireInput;
    try {
      wire = { params: snapshot(input.params), query: snapshot(input.query), body: snapshot(input.body) };
    } catch {
      return { ok: false, status: 0, code: "client_rejected" };
    }
    if (names === undefined) {
      const route = MIGRATION_ROUTES.get(id);
      if (route === undefined) return { ok: false, status: 0, code: "client_rejected" };
      const protocol = options.protocol !== undefined && MIGRATION_PROTOCOL_ROUTES.has(id) ? options.protocol : undefined;
      return callMigrationRoute(id, route, wire, baseUrl, transport, protocol);
    }
    const publishedId = id as OperationId;
    const ahead = AHEAD_OF_PACKAGE.has(id) ? MIGRATION_ROUTES.get(id) : undefined;
    if (ahead !== undefined && !PARTS.every((part) => validateInput(publishedId, part, wire[part]))
      && acceptedByExtract(id, wire)) {
      return callMigrationRoute(id, ahead, wire, baseUrl, transport);
    }
    if (!PARTS.every((part) => onlyNamed(names[part], wire[part]) && validateInput(publishedId, part, wire[part]))) {
      return { ok: false, status: 0, code: "client_rejected" };
    }
    let bodyBytes = 0;
    let code: string | undefined;
    const protocol = options.protocol !== undefined && PROTOCOL_ROUTES.has(id) ? options.protocol : undefined;
    let errorBytes: ArrayBuffer | null = null;
    let answered = 0;
    const measured: typeof fetch = async (url, init) => {
      const headers = protocol === undefined ? init?.headers : { ...(init?.headers as Record<string, string>), "ductus-protocol": protocol };
      const res = await transport(url, protocol === undefined ? init : { ...init, headers });
      answered = res.status;
      const bytes = res.type === "opaqueredirect" ? new ArrayBuffer(0) : await res.clone().arrayBuffer();
      bodyBytes = bytes.byteLength;
      if (protocol !== undefined && res.status >= 400 && res.headers.get("content-type")?.startsWith("application/json")) errorBytes = bytes;
      // The same content type test as the generated client: only a body it reads as JSON.
      if (res.status === SESSION_EXPIRED_ENTRY.status && res.headers.get("content-type")?.startsWith("application/json")) code = sentCode(bytes);
      return res;
    };
    let result: Awaited<ReturnType<ReturnType<typeof createClient>>>;
    try {
      result = await createClient(baseUrl, measured)(publishedId, wire as Pick<Operations[OperationId], Part>);
    } catch (error) {
      // A JSON content type with a body that is not JSON breaks the contract too.
      if (error instanceof SyntaxError) return { ok: false, status: unreadableStatus(answered), code: "unexpected" };
      throw error;
    }
    if (!result.ok) {
      const expired = result.status === SESSION_EXPIRED_ENTRY.status && result.code === "unexpected"
        && code === SESSION_EXPIRED_ENTRY.code && RESPONSES.get(id)?.["401"] !== undefined && !id.startsWith("auth.");
      if (expired) return { ok: false, status: 401, code: "session_expired" };
      const kept = errorBytes === null ? undefined : declaredError(id, result.status, errorBytes);
      return (kept === undefined ? result : { ...result, body: kept }) as ApiResult<Id>;
    }
    const { status, body } = result as unknown as { status: number; body: unknown };
    return responseMatches(id, status, body, bodyBytes) ? result as ApiResult<Id> : { ok: false, status, code: "unexpected" };
  };
}

// ---------------------------------------------------------------------------
// Session of the institution front (contract #2028 c.6993786629 §3.3).
// The existing shell uses this reader for the older session shapes. New callers
// can use createApi("profile.me.get") for the closed migration contract.

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
  | { readonly kind: "unavailable"; readonly noRole?: true };

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
 * out, anything else (a broken connection included) unavailable; 403 is
 * unavailable too, marked `noRole` (signed in through AAI@EduHr, no role: E-1
 * "bezuloge"). Same origin, with the session cookie.
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
    if (res.status === 403) return { kind: "unavailable", noRole: true };
    if (res.status !== 200 || !res.headers.get("content-type")?.startsWith("application/json")) return { kind: "unavailable" };
    const session = parseSession(await res.json());
    return session === null ? { kind: "unavailable" } : { kind: "signedIn", session };
  } catch {
    return { kind: "unavailable" };
  }
}

/**
 * Leaves the app for an address of the same origin. Every navigation out of
 * the app goes here, except the sign-out, which follows the logout route
 * natively (followLogoutNatively).
 */
export function leaveFor(href: string): void {
  globalThis.location.assign(href);
}

/** Sends the browser to AAI@EduHr sign-in, returning to `here` (the app's own path) afterwards. */
export function goToSignIn(here: string, leave: (href: string) => void = leaveFor): void {
  leave(signInHref(here));
}

/**
 * Signs out through auth.logout.post (303 on success). True when the server
 * ended the session; the caller then calls followLogoutNatively, so the
 * browser follows the route on to the provider's logout (INT-20c).
 */
export async function signOut(options: ApiOptions = {}): Promise<boolean> {
  try {
    const result = await createApi(options)("auth.logout.post", { params: undefined, query: undefined, body: undefined } as Input<"auth.logout.post">);
    return result.ok;
  } catch {
    return false;
  }
}

/** The path of POST auth.logout.post, read from the contract; throws unless there is exactly one local one. */
export function logoutPath(paths: Paths): string {
  const found = Object.entries(paths).filter(([, methods]) => methods.post?.operationId === "auth.logout.post");
  const path = found[0]?.[0];
  if (found.length !== 1 || path === undefined || !path.startsWith("/") || path.startsWith("//")) {
    throw new Error("contract: no single POST auth.logout.post");
  }
  return path;
}
export const LOGOUT_PATH = logoutPath((openapi as unknown as { paths: Paths }).paths);

/**
 * WEB-39 (DAN-212): after `signOut` confirmed, the same POST once more,
 * natively, so the browser follows the route's 303 on to the provider's
 * logout, which a fetch cannot. It goes without the cookie, so it closes
 * nothing twice. A hidden form of its own, so it holds while the page
 * re-renders; the one native request outside createApi.
 */
export function followLogoutNatively(doc: Pick<Document, "createElement" | "body"> = document): void {
  const form = doc.createElement("form");
  form.method = "post";
  form.action = LOGOUT_PATH;
  form.hidden = true;
  doc.body.append(form);
  form.submit();
}

// ---------------------------------------------------------------------------
// WEB-02 (Ductus#2028 c.7008147932): the Next.js app passes every /api/v1/*
// request on to Institution_server, and its server-side pages read through
// createApi with the request's cookies. Both live here, the one file that may
// call the API; src/client/server.ts and src/app/api/v1/[...path] only wire
// them up. The web never reaches the database.

/** The path prefix the institution server owns; nothing else is passed on. */
export const SERVER_PREFIX = "/api/v1/";

/** Hop-by-hop headers (RFC 9110 §7.6.1) and those the transport sets itself: never passed on. */
const NOT_FORWARDED: ReadonlySet<string> = new Set([
  "connection", "keep-alive", "proxy-connection", "proxy-authenticate", "proxy-authorization", "te", "trailer",
  "transfer-encoding", "upgrade", "host", "content-length",
]);
/** The transport already decoded the body, so its encoding and length no longer hold. */
const NOT_RETURNED: ReadonlySet<string> = new Set([...NOT_FORWARDED, "content-encoding", "set-cookie"]);
const NULL_BODY_STATUS: ReadonlySet<number> = new Set([101, 103, 204, 205, 304]);

function proxyError(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: { "cache-control": "no-store" } });
}

/**
 * One request of the browser, passed on to the institution server at
 * `server` (an origin) unchanged: method, path, query, body and headers but
 * the hop-by-hop ones, with the cookie. Redirects are not followed, so a 303
 * of sign-in or sign-out reaches the browser with its Location and every
 * Set-Cookie. A path outside /api/v1/ is 404; an unreachable server is 502.
 */
export async function forwardToServer(request: Request, server: string, transport: typeof fetch = (input, init) => fetch(input, init)): Promise<Response> {
  const incoming = new URL(request.url);
  if (!incoming.pathname.startsWith(SERVER_PREFIX)) return proxyError(404, "not_found");
  const target = new URL(incoming.pathname + incoming.search, server);
  const headers = new Headers();
  request.headers.forEach((value, name) => {
    if (!NOT_FORWARDED.has(name)) headers.set(name, value);
  });
  headers.set("x-forwarded-host", request.headers.get("host") ?? incoming.host);
  headers.set("x-forwarded-proto", incoming.protocol.replace(/:$/, ""));
  const withBody = request.method !== "GET" && request.method !== "HEAD";
  let res: Response;
  try {
    res = await transport(target, {
      method: request.method,
      headers,
      body: withBody ? await request.arrayBuffer() : undefined,
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    return proxyError(502, "server_unavailable");
  }
  const out = new Headers();
  res.headers.forEach((value, name) => {
    if (!NOT_RETURNED.has(name)) out.set(name, value);
  });
  for (const cookie of res.headers.getSetCookie()) out.append("set-cookie", cookie);
  const empty = request.method === "HEAD" || NULL_BODY_STATUS.has(res.status);
  return new Response(empty ? null : res.body, { status: res.status, statusText: res.statusText, headers: out });
}

/** A transport that sends `cookie` (the browser request's Cookie header) with every call; for server-side reads. */
export function cookieTransport(cookie: string, transport: typeof fetch = (input, init) => fetch(input, init)): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    if (cookie !== "") headers.set("cookie", cookie);
    return transport(input, { ...init, headers, cache: "no-store" });
  };
}

/**
 * WEB-1402 (plan M2.1, DAN-330): the student's "Započni rad", POST /api/v1/assignments/{id}/start.
 * Not in the pinned contract yet (TODO(ugovor)), so createApi does not know it; kept here,
 * the only file allowed an API URL. The id is a path segment, encoded.
 */
export type StartWorkTransport = (
  assignmentId: string,
) => Promise<{ ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>;

/** The code of an error body (`code`, then `error`), or "error" when there is none. */
async function errorCodeOf(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null) return "error";
    const record = body as Record<string, unknown>;
    const code = Object.hasOwn(record, "code") ? record.code : Object.hasOwn(record, "error") ? record.error : undefined;
    return typeof code === "string" ? code : "error";
  } catch {
    return "error";
  }
}

/**
 * The transport of "Započni rad": the browser's own fetch, same origin, session cookie only,
 * an empty JSON body. A failure keeps its status and the code of its body (a 401 that says the
 * session ended reads differently from one that never had a session); an answer without a JSON
 * body is a failure, never a started work.
 */
export function startWorkCall(transport: typeof fetch = browserTransport): StartWorkTransport {
  return async (assignmentId) => {
    try {
      const path = `/api/v1/assignments/${encodeURIComponent(assignmentId)}/start`;
      const response = await transport(new URL(path, globalThis.location.origin), {
        method: "POST",
        redirect: "manual",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (response.status >= 400) return { ok: false, status: response.status, code: await errorCodeOf(response) };
      const type = response.headers.get("content-type") ?? "";
      if (!type.startsWith("application/json")) return { ok: false, status: 0, code: "unexpected" };
      return { ok: true, status: response.status, body: await response.json() };
    } catch {
      return { ok: false, status: 0, code: "unexpected" };
    }
  };
}

/**
 * WEB-1304 (plan M7.10): the student's portable record, student.portable-record.get. The answer is a
 * file, not JSON, so createApi does not read it; the path and the id's shape come from the contract
 * and the caller (client/portable-record.ts) reads the answer. The id is a path segment, encoded.
 */
const PORTABLE_RECORD = migrationContracts["student.portable-record.get"];

export type PortableRecordTransport = (submissionId: string) => Promise<Response>;

export function portableRecordCall(transport: typeof fetch = browserTransport, baseUrl: string = globalThis.location.origin): PortableRecordTransport {
  return (submissionId) => transport(new URL(PORTABLE_RECORD.path.replace("{submissionId}", encodeURIComponent(submissionId)), baseUrl), {
    method: PORTABLE_RECORD.method,
    redirect: "manual",
    credentials: "same-origin",
  });
}

/** Whether an id is one the contract's params accept (a UUID). */
export function portableRecordIdFits(submissionId: string): boolean {
  return matchesSchema(PORTABLE_RECORD.params as Schema, { submissionId });
}

/**
 * WEB-1302B (SRV-1308): the student's one-time download, student.data-export.get. The answer is
 * a file, which createApi does not read, so the path comes from the contract and the caller
 * (client/student-data-export.ts) reads the answer. The token is a path segment, encoded, and no
 * session is sent.
 */
const STUDENT_DATA_DOWNLOAD = migrationContracts["student.data-export.get"].path;

export type StudentDataDownloadTransport = (token: string) => Promise<Response>;

export function studentDataDownloadCall(transport: typeof fetch = browserTransport, baseUrl: string = globalThis.location.origin): StudentDataDownloadTransport {
  return (token) => transport(new URL(STUDENT_DATA_DOWNLOAD.replace("{token}", encodeURIComponent(token)), baseUrl), {
    method: "GET",
    redirect: "manual",
    credentials: "omit",
  });
}

/**
 * ED-10 (NF2-P10): student.assistant-request.post. The server requires an Idempotency-Key header,
 * which createApi does not send, so the path comes from the contract and the caller
 * (host/editor/assistant-chat) reads the answer with responseMatches. The same key repeats a retry
 * of the same question; a new question gets a new key.
 */
const ASSISTANT_REQUEST = migrationContracts["student.assistant-request.post"];

export type AssistantRequestTransport = (body: unknown, idempotencyKey: string) => Promise<Response>;

export function assistantRequestCall(transport: typeof fetch = browserTransport, baseUrl: string = globalThis.location.origin): AssistantRequestTransport {
  return (body, idempotencyKey) => transport(new URL(ASSISTANT_REQUEST.path, baseUrl), {
    method: ASSISTANT_REQUEST.method,
    redirect: "manual",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
    body: JSON.stringify(body),
  });
}
