// The model of "Prijavi problem" (DAN-873, web 2.c4): what the form may send
// and how each answer of support.problem-report.post reads. Ported from Ductus
// src/components/support/problem-report-client.ts and
// src/domain/support/problem-report.ts at 393b8e0 (DAN-431) without the network
// part: the call goes through src/client in the next cut (873-2). Pure, so
// every input class is tested against the route's vectors without a browser.
import { messagesEn } from "../../../locales/en.ts";
import { messagesHr } from "../../../locales/hr.ts";

export const PROBLEM_REPORT_DESCRIPTION_MAX = 1000;
export const PROBLEM_REPORT_CATEGORIES = ["technical", "account", "course"] as const;
export type ProblemReportCategory = (typeof PROBLEM_REPORT_CATEGORIES)[number];
export type BrowserFamily = "chromium" | "firefox" | "safari" | "other";
export type SyncState =
  | "EDITING" | "SAVING_LOCAL" | "LOCAL_DURABLE" | "SYNCING" | "SYNCED" | "CONFLICT" | "ERROR" | "RECOVERY_REQUIRED";

/** The form's input: the page's address and the browser's user agent stay here. */
export type ProblemReportInput = {
  appVersion: string;
  category: ProblemReportCategory;
  description: string;
  pathname: string;
  syncState: SyncState | null;
  userAgent: string;
};

/** The wire body; route is a template of PROBLEM_REPORT_ROUTES, browser only family and major. */
export type ProblemReportBody = {
  appVersion: string;
  browser: { family: BrowserFamily; major: number | null };
  category: ProblemReportCategory;
  description: string;
  route: ProblemReportRoute | null;
  syncState: SyncState | null;
};

/**
 * The server's closed list of 27 page templates (openapi summary of the route),
 * as Ductus src/domain/support/problem-report.ts at 393b8e0.
 */
export const PROBLEM_REPORT_ROUTES = [
  "/", "/kako-radi", "/nastavnik", "/nastavnik/brz-put", "/nastavnik/kolegiji", "/nastavnik/mentorstva",
  "/nastavnik/rad/[id]", "/nastavnik/rad/[id]/reprodukcija",
  "/nastavnik/zadatak/[assignmentId]/rad/[documentId]/jezik", "/nastavnik/zadatak/[assignmentId]/uredi",
  "/nastavnik/zadatak/novi", "/prijava", "/rad", "/rad/[assignmentId]/dnevnik-pristupa",
  "/rad/[assignmentId]/predaja", "/rad/[assignmentId]/reprodukcija", "/stanje", "/upis",
  "/upis/kolegij/[courseId]", "/ustanova", "/ustanova/kolegiji", "/ustanova/korisnici", "/ustanova/pravila",
  "/zadaci", "/zadaci/kolegiji", "/zadaci/radovi", "/zadatak/[id]",
] as const;
export type ProblemReportRoute = (typeof PROBLEM_REPORT_ROUTES)[number];

const isRoute = (value: string): value is ProblemReportRoute => (PROBLEM_REPORT_ROUTES as readonly string[]).includes(value);

/**
 * The template of a page path, sent instead of the path: a query and a hash
 * are dropped, an id segment becomes its bracket name,
 * and a path that is no known page gives null. No identifier leaves the page.
 */
export function problemReportRoute(pathname: string): ProblemReportRoute | null {
  const path = pathname.split(/[?#]/, 1)[0] ?? "";
  if (!path.startsWith("/")) return null;
  const trimmed = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  if (isRoute(trimmed)) return trimmed;
  const segments = trimmed.split("/");
  return PROBLEM_REPORT_ROUTES.find((template) => {
    const parts = template.split("/");
    return parts.length === segments.length
      && parts.every((part, i) => (part.startsWith("[") ? segments[i] !== "" : part === segments[i]));
  }) ?? null;
}

/** Family and major version only; the rest of the user agent stays here. */
export function browserFromUserAgent(userAgent: string): ProblemReportBody["browser"] {
  const major = (pattern: RegExp): number | null => {
    const value = Number(pattern.exec(userAgent)?.[1]);
    return Number.isInteger(value) && value >= 0 && value <= 999 ? value : null;
  };
  if (/Firefox\/\d/.test(userAgent)) return { family: "firefox", major: major(/Firefox\/(\d+)/) };
  if (/(?:Chrome|Chromium|CriOS)\/\d/.test(userAgent)) return { family: "chromium", major: major(/(?:Chrome|Chromium|CriOS)\/(\d+)/) };
  if (/Safari\/\d/.test(userAgent) && /Version\/\d/.test(userAgent)) return { family: "safari", major: major(/Version\/(\d+)/) };
  return { family: "other", major: null };
}

export type DescriptionCheck = "ok" | "empty" | "tooLong" | "invalid";

// C0, DEL and C1 once newline and tab are removed; bidi embeddings and isolates.
const CONTROL = /\p{Cc}/u;
const BIDI = /[\u202A-\u202E\u2066-\u2069]/u;
// Under /u a surrogate pair is one code point, so this finds only a lone one.
const LONE_SURROGATE = /[\uD800-\uDFFF]/u;
// Anything but White_Space and zero width, as the server's check.
const VISIBLE =
  /[^\u0009-\u000D\u0020\u0085\u00A0\u1680\u2000-\u200D\u2028\u2029\u202F\u205F\u2060\u3000\uFEFF]/u;

function isDescription(text: string): boolean {
  if (LONE_SURROGATE.test(text)) return false;
  const length = [...text].length;
  if (length < 1 || length > PROBLEM_REPORT_DESCRIPTION_MAX) return false;
  if (CONTROL.test(text.replace(/[\n\t]/g, "")) || BIDI.test(text)) return false;
  return VISIBLE.test(text);
}

/** Why the description cannot be sent yet; "ok" exactly when the route accepts it. */
export function checkDescription(text: string): DescriptionCheck {
  if (isDescription(text)) return "ok";
  if (!LONE_SURROGATE.test(text) && [...text].length > PROBLEM_REPORT_DESCRIPTION_MAX) return "tooLong";
  if (!VISIBLE.test(text)) return "empty";
  return "invalid";
}

/**
 * The body the form sends, keys in sorted order (the JCS form of these values),
 * or null when the description or category is outside its class. The address
 * goes as its template and the user agent as family and major only.
 */
export function buildProblemReportBody(input: ProblemReportInput): ProblemReportBody | null {
  if (checkDescription(input.description) !== "ok") return null;
  if (!(PROBLEM_REPORT_CATEGORIES as readonly string[]).includes(input.category)) return null;
  return {
    appVersion: input.appVersion,
    browser: browserFromUserAgent(input.userAgent),
    category: input.category,
    description: input.description,
    route: problemReportRoute(input.pathname),
    syncState: input.syncState,
  };
}

export type SendOutcome =
  | { kind: "sent"; reference: string }
  | { kind: "failed"; messageKey: string; retryAt: number | null };

const REFERENCE = /^PR-[0-9A-F]{10}$/;
const RETRY_AFTER_MAX_SECONDS = 86_400;

/** The route's own texts: only 503 says the report may have arrived anyway. */
const FAILURE_BY_STATUS: Readonly<Record<number, string>> = {
  401: "support.failure.signedOut",
  413: "support.failure.tooLarge",
  422: "support.failure.invalid",
  429: "support.failure.tooMany",
  503: "support.failure.unavailable",
};
const UNKNOWN = "support.failure.unknown";

/**
 * When a 429 may be retried: only delay-seconds (RFC 9110, 1*DIGIT) up to a
 * day. The route's contract declares no header, so anything else is null.
 */
export function retryAtFrom(header: string | null, now: number): number | null {
  if (header === null || !/^[0-9]{1,5}$/.test(header)) return null;
  const seconds = Number(header);
  return seconds <= RETRY_AFTER_MAX_SECONDS ? now + seconds * 1000 : null;
}

function ownText(catalogue: unknown, key: string): boolean {
  let node = catalogue;
  for (const part of key.split(".")) {
    if (node === null || typeof node !== "object" || !Object.hasOwn(node, part)) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string";
}

/** The problem body's messageKey, when it names an errors.* text of both catalogues. */
function catalogueKey(body: unknown): string | null {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return null;
  const key = Object.hasOwn(body, "messageKey") ? (body as { messageKey: unknown }).messageKey : undefined;
  if (typeof key !== "string" || !key.startsWith("errors.")) return null;
  return ownText(messagesHr, key) && ownText(messagesEn, key) ? key : null;
}

function isReference(body: unknown): body is { reference: string } {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return false;
  const keys = Object.keys(body);
  const reference = (body as { reference?: unknown }).reference;
  return keys.length === 1 && keys[0] === "reference" && typeof reference === "string" && REFERENCE.test(reference);
}

/** What an answer means for the person sending; never throws. */
export function outcomeFromResponse(status: number, body: unknown, retryAfter: string | null, now: number): SendOutcome {
  if (status === 201) {
    return isReference(body) ? { kind: "sent", reference: body.reference } : { kind: "failed", messageKey: UNKNOWN, retryAt: null };
  }
  return {
    kind: "failed",
    messageKey: FAILURE_BY_STATUS[status] ?? catalogueKey(body) ?? UNKNOWN,
    retryAt: status === 429 ? retryAtFrom(retryAfter, now) : null,
  };
}
