import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { messagesEn } from "../../../locales/en.ts";
import { messagesHr } from "../../../locales/hr.ts";
import { findForbiddenTerms } from "../../../scripts/forbidden-terms/terms.ts";
import {
  buildProblemReportBody,
  browserFromUserAgent,
  checkDescription,
  PROBLEM_REPORT_ROUTES,
  problemReportRoute,
  outcomeFromResponse,
  retryAtFrom,
  type ProblemReportInput,
} from "./problem-report";

// Verbatim copy of ductura/server server/contracts/vectors/support.problem-report.post.json
// at ea171eff (Ductus#1836 c.6926566704); git blob 6bfb2d32 as in test-fakes-v1.0.0.
const raw = readFileSync(new URL("./fixtures/support.problem-report.post.json", import.meta.url), "utf8");
type Vector = {
  name: string;
  kind: "success" | "error";
  request: { body?: Record<string, unknown>; rawBody?: string };
  response: { status: number; body: unknown };
};
const vectors = (JSON.parse(raw) as { vectors: Vector[] }).vectors;
const vector = (name: string): Vector => vectors.find((v) => v.name === name) as Vector;
const NOW = 1_800_000_000_000;

// Invented addresses and user agents that give the vectors' route and browser.
const PATHNAME: Record<string, string> = { "/zadaci": "/zadaci/?naslov=Moj%20rad#uvod", null: "/nepoznato/123" };
const USER_AGENT: Record<string, string> = {
  "firefox 140": "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0",
  "other null": "curl/8.0",
};

/** The form input that gives the vector's body, its keys in reverse order. */
const inputOf = (name: string): ProblemReportInput => {
  const body = vector(name).request.body as Record<string, unknown> & { browser: { family: string; major: unknown } };
  return {
    userAgent: USER_AGENT[`${body.browser.family} ${String(body.browser.major)}`],
    syncState: body.syncState,
    pathname: PATHNAME[String(body.route)],
    description: body.description,
    category: body.category,
    appVersion: body.appVersion,
  } as ProblemReportInput;
};

const textAt = (catalogue: unknown, key: string): unknown =>
  key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], catalogue);

describe("fixture", () => {
  it("is the source blob 6bfb2d32, line ends normalised", () => {
    const lf = Buffer.from(raw.replace(/\r\n/g, "\n"), "utf8");
    const blob = createHash("sha1").update(`blob ${lf.length}\0`).update(lf).digest("hex");
    expect(blob).toBe("6bfb2d3265e581ebad1ada98d35bac960f0c6193");
  });
});

describe("empty, too long or invalid is not sent (K3)", () => {
  const cases: [string, string][] = [
    ["", "empty"], ["   ", "empty"], ["\t", "empty"], ["\r", "empty"], ["\u0085", "empty"],
    ["\u00A0", "empty"], ["\u200B", "empty"],
    ["a".repeat(1001), "tooLong"], ["\u202E" + "a".repeat(1000), "tooLong"],
    ["a\r\nb", "invalid"], ["a\u007F", "invalid"], ["a\u0000", "invalid"], ["abc\u0085", "invalid"],
    ["\u202E", "invalid"], ["a\u2066b", "invalid"], ["a\uD800", "invalid"], ["\uDC00".repeat(1001), "invalid"],
    ["\u{1F600}".repeat(1000), "ok"], ["\u{1F600}".repeat(1001), "tooLong"], ["a\nb\tc", "ok"],
    ["Ne mogu spremiti\n\u010D\u0107\u017E\u0161\u0111 \u010C\u0106\u017D\u0160\u0110", "ok"], ["a\u0007b", "invalid"],
  ];
  it.each(cases)("%j is %s", (text, expected) => {
    expect(checkDescription(text)).toBe(expected);
    const body = buildProblemReportBody({ ...inputOf("recorded"), description: text });
    expect(body === null).toBe(expected !== "ok");
  });
});

describe("the longest body stays under the route's 8192 bytes (x-max-body-bytes)", () => {
  // Most UTF-8 bytes per code point: four-byte characters, or two-byte JSON escapes of " and \.
  it.each(["\u{1F600}", '"', "\\", "\u20AC"])("1000 x %j with the longest context", (char) => {
    const body = buildProblemReportBody({
      ...inputOf("recorded"),
      appVersion: "9999.9999.9999+" + "f".repeat(40),
      description: char.repeat(1000),
      pathname: "/nastavnik/zadatak/" + "a".repeat(2000) + "/rad/" + "b".repeat(2000) + "/jezik",
      userAgent: "Mozilla/5.0 Firefox/999",
      syncState: "RECOVERY_REQUIRED",
    });
    expect(body).not.toBeNull();
    expect(new TextEncoder().encode(JSON.stringify(body)).length).toBeLessThan(8192);
  });
});

describe("body equals the vector body (K2)", () => {
  it.each(["recorded", "recorded-without-context"])("%s", (name) => {
    expect(JSON.stringify(buildProblemReportBody(inputOf(name)))).toBe(JSON.stringify(vector(name).request.body));
  });

  it("not-canonical holds the same value in other bytes", () => {
    const body = buildProblemReportBody(inputOf("recorded"));
    const rawBody = vector("not-canonical").request.rawBody as string;
    expect(JSON.parse(rawBody)).toEqual(body);
    expect(JSON.stringify(body)).not.toBe(rawBody);
  });

  it("a category outside the route's set is not sent", () => {
    expect(buildProblemReportBody(inputOf("invalid-input"))).toBeNull();
  });
});

describe("no identifier from the address or the user agent leaves the page", () => {
  const ID = "00000000-0000-4000-8000-000000000001";
  it("an id becomes its template, a query and a hash are dropped", () => {
    const body = buildProblemReportBody({ ...inputOf("recorded"), pathname: `/nastavnik/rad/${ID}?naslov=Uvod#odlomak` });
    expect(body?.route).toBe("/nastavnik/rad/[id]");
    expect(JSON.stringify(body)).not.toMatch(/00000000|naslov|Uvod|odlomak|Gecko|Linux/);
  });

  it.each([
    ["/", "/"], ["/rad", "/rad"], ["/rad/", "/rad"], ["/rad?naslov=Moj%20rad#uvod", "/rad"],
    [`/zadatak/${ID}`, "/zadatak/[id]"], ["/nastavnik/rad/abc", "/nastavnik/rad/[id]"],
    ["/nastavnik/zadatak/novi", "/nastavnik/zadatak/novi"], ["/nastavnik/zadatak/abc/uredi", "/nastavnik/zadatak/[assignmentId]/uredi"],
    ["/rad/abc/predaja", "/rad/[assignmentId]/predaja"], ["/upis/kolegij/k1", "/upis/kolegij/[courseId]"],
    ["/zadatak/", null], ["/zadatak//", null], ["/nepoznato", null], ["/nepoznato/123", null], ["rad", null], ["", null],
    ["https://ductura.example/rad", null], ["\\rad", null], ["/toString", null], ["/__proto__", null], ["/RAD", null],
  ])("%j gives %s", (path, template) => {
    expect(problemReportRoute(path)).toBe(template);
  });

  it("every template maps to itself and fits the route schema", () => {
    expect(PROBLEM_REPORT_ROUTES).toHaveLength(27);
    for (const route of PROBLEM_REPORT_ROUTES) {
      expect(problemReportRoute(route)).toBe(route);
      expect(route.length).toBeLessThanOrEqual(128);
      expect(route).toMatch(/^\/(?:(?:[a-z]+(?:-[a-z]+)*|\[[A-Za-z]+\])(?:\/(?:[a-z]+(?:-[a-z]+)*|\[[A-Za-z]+\]))*)?$/);
    }
  });

  it.each([
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0", "firefox", 133],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15", "safari", 18],
    ["Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0", "chromium", 130],
    ["Mozilla/5.0 Chrome/99999.0", "chromium", null],
    ["curl/8.0", "other", null],
    ["", "other", null],
  ] as const)("user agent %j", (ua, family, major) => {
    expect(browserFromUserAgent(ua)).toEqual({ family, major });
  });
});

describe("success vectors give the reference (K1)", () => {
  it.each(["recorded", "recorded-without-context"])("%s", (name) => {
    const { status, body } = vector(name).response;
    expect(outcomeFromResponse(status, body, null, NOW)).toEqual({ kind: "sent", reference: (body as { reference: string }).reference });
  });

  it.each([{ reference: "PR-0a1b2c3d4e" }, { reference: "PR-0A1B2C3D" }, { reference: "PR-0A1B2C3D4E", extra: 1 }, null, []])(
    "201 with %j is not a confirmation",
    (body) => {
      expect(outcomeFromResponse(201, body, null, NOW)).toEqual({ kind: "failed", messageKey: "support.failure.unknown", retryAt: null });
    },
  );
});

describe("429 carries the wait from retry-after (K4)", () => {
  const { status, body } = vector("too-many-reports").response;
  it("the vector's 429, with the header added", () => {
    expect(outcomeFromResponse(status, body, "120", NOW)).toEqual({ kind: "failed", messageKey: "support.failure.tooMany", retryAt: NOW + 120_000 });
    expect(outcomeFromResponse(status, body, null, NOW)).toEqual({ kind: "failed", messageKey: "support.failure.tooMany", retryAt: null });
    expect(retryAtFrom("0", NOW)).toBe(NOW);
    expect(retryAtFrom("86400", NOW)).toBe(NOW + 86_400_000);
  });

  it.each([
    "", " 120", "120\r\n", "12\t0", "120\u00A0", "\u007F", "-1", "+5", "1.5", "0x10", "1e3", "86401",
    "99999999999999999999", "Sun, 06 Nov 1994 08:49:37 GMT", "Sun, 31 Feb 2026 10:00:00 GMT",
  ])("%j gives no wait", (header) => {
    expect(retryAtFrom(header, NOW)).toBeNull();
    expect(outcomeFromResponse(status, body, header, NOW)).toMatchObject({ messageKey: "support.failure.tooMany", retryAt: null });
  });

  it("another status ignores the header", () => {
    expect(outcomeFromResponse(503, null, "120", NOW)).toMatchObject({ retryAt: null });
  });
});

describe("every error vector maps to a catalogue text (K5)", () => {
  const byRoute: Record<number, string> = {
    401: "support.failure.signedOut", 413: "support.failure.tooLarge", 422: "support.failure.invalid",
    429: "support.failure.tooMany", 503: "support.failure.unavailable",
  };
  it.each(vectors.filter((v) => v.kind === "error").map((v) => [v.name, v] as const))("%s", (_name, v) => {
    const outcome = outcomeFromResponse(v.response.status, v.response.body, null, NOW);
    const expected = byRoute[v.response.status] ?? (v.response.body as { messageKey: string }).messageKey;
    expect(outcome).toEqual({ kind: "failed", messageKey: expected, retryAt: null });
    expect(typeof textAt(messagesHr, expected)).toBe("string");
    expect(typeof textAt(messagesEn, expected)).toBe("string");
  });

  it.each([
    "__proto__", "toString", "constructor", "errors.toString", "errors.__proto__", "errors.constructor", "errors",
    "errors.", "support.ended", "app.name", "errors.tooManyReports", 7, null,
  ])("messageKey %j falls back to the route's text", (messageKey) => {
    expect(outcomeFromResponse(403, { messageKey }, null, NOW)).toMatchObject({ messageKey: "support.failure.unknown" });
  });

  it.each([null, [], "errors.crossSite", 0])("body %j falls back to the route's text", (body) => {
    expect(outcomeFromResponse(400, body, null, NOW)).toMatchObject({ messageKey: "support.failure.unknown" });
  });
});

describe("no forbidden term in the texts the model can return (K6)", () => {
  it.each([
    ["hr", messagesHr],
    ["en", messagesEn],
  ] as const)("%s", (lang, catalogue) => {
    const texts = [catalogue.support.check, catalogue.support.failure, catalogue.errors].flatMap((part) => Object.values(part));
    expect(texts.length).toBeGreaterThan(40);
    expect(texts.flatMap((text) => findForbiddenTerms(text, lang))).toEqual([]);
  });
});
