// DAN-1568: what the browser may say about an error nobody caught: its kind,
// a class of four words, the page of the app as a code and the app's version,
// the four fields of client.error.post (ductura/Institution_server#795). Never the
// message, the stack, a file name, the address with its query, or anything
// typed into a field. Pure functions and one small reporter; the sender is
// given from outside and goes through src/client/api.ts once the institution
// server has a route for it. Until then nothing here is installed.

export const BROWSER_ERROR_KINDS = ["error", "unhandledrejection", "render"] as const;
export type BrowserErrorKind = (typeof BROWSER_ERROR_KINDS)[number];

export const BROWSER_ERROR_CLASSES = ["type_error", "range_error", "reference_error", "syntax_error", "other"] as const;
export type BrowserErrorClass = (typeof BROWSER_ERROR_CLASSES)[number];

/** The codes of client.error.post for the pages of this app; any other path is "other". */
export const PAGE_CODES: Readonly<Record<string, string>> = Object.freeze({
  "/": "home",
  "/kako-radi": "how_it_works",
  "/rad": "work",
  "/upis": "enroll",
  "/zadaci": "assignments",
  "/zadaci/kolegiji": "assignment_courses",
  "/zadaci/radovi": "assignment_works",
  "/nastavnik": "teacher",
  "/nastavnik/brz-put": "teacher_fast_path",
  "/nastavnik/mentorstva": "teacher_mentorships",
  "/ustanova": "institution",
  "/ustanova/kolegiji": "institution_courses",
  "/ustanova/korisnici": "institution_users",
  "/ustanova/pravila": "institution_rules",
});

export type BrowserErrorRecord = {
  readonly appVersion: string;
  readonly errorClass: BrowserErrorClass;
  readonly kind: BrowserErrorKind;
  /** A code of PAGE_CODES or "other". Never the address. */
  readonly page: string;
};

/** The class of a thrown value from its prototype alone; never throws, never reads a property. */
export function errorClassOf(value: unknown): BrowserErrorClass {
  try {
    if (value instanceof TypeError) return "type_error";
    if (value instanceof RangeError) return "range_error";
    if (value instanceof ReferenceError) return "reference_error";
    if (value instanceof SyntaxError) return "syntax_error";
  } catch {
    // A Proxy whose getPrototypeOf throws is "other", like any unknown value.
  }
  return "other";
}

/** The page code of an app route. An id, a query or an unknown path is "other"; an inherited name never matches. */
export function pageCode(route: string): string {
  return Object.hasOwn(PAGE_CODES, route) ? PAGE_CODES[route]! : "other";
}

const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;

export type BrowserErrorReporter = {
  /** Records one error. True when a record was handed to the sender. */
  report(kind: BrowserErrorKind, error: unknown): boolean;
};

/** Most records one page load sends, so a loop of errors is not a loop of requests. */
export const MAX_BROWSER_ERROR_RECORDS = 5;

/**
 * `send` is called at most once per kind and class, and at most `limit` times
 * in all. Whatever it does (throws, rejects, causes another error while it
 * runs) never reaches the caller and never starts another report.
 */
export function createBrowserErrorReporter(options: {
  send: (record: BrowserErrorRecord) => unknown;
  route: () => string;
  version: string;
  limit?: number;
}): BrowserErrorReporter {
  const limit = options.limit ?? MAX_BROWSER_ERROR_RECORDS;
  const version = VERSION.test(options.version) ? options.version : "0.0.0";
  const seen = new Set<string>();
  let sending = false;
  return {
    report(kind, error) {
      if (sending) return false;
      sending = true;
      try {
        const errorClass = errorClassOf(error);
        const key = `${kind}:${errorClass}`;
        if (seen.has(key) || seen.size >= limit) return false;
        seen.add(key);
        const record: BrowserErrorRecord = { appVersion: version, errorClass, kind, page: pageCode(options.route()) };
        const sent = options.send(Object.freeze(record));
        // A rejected send is an unhandled rejection of its own unless it is caught here.
        if (sent instanceof Promise) sent.catch(() => undefined);
        return true;
      } catch {
        return false;
      } finally {
        sending = false;
      }
    },
  };
}

type Listener = (event: { error?: unknown; reason?: unknown }) => void;
export type ErrorEventTarget = {
  addEventListener(type: "error" | "unhandledrejection", listener: Listener): void;
  removeEventListener(type: "error" | "unhandledrejection", listener: Listener): void;
};

/** Listens on `target` (the window); returns the function that stops listening. */
export function installBrowserErrorListeners(target: ErrorEventTarget, reporter: BrowserErrorReporter): () => void {
  const onError: Listener = (event) => void reporter.report("error", event.error);
  const onRejection: Listener = (event) => void reporter.report("unhandledrejection", event.reason);
  target.addEventListener("error", onError);
  target.addEventListener("unhandledrejection", onRejection);
  return () => {
    target.removeEventListener("error", onError);
    target.removeEventListener("unhandledrejection", onRejection);
  };
}
