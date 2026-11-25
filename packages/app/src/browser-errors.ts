// DAN-1568: what the browser may say about an error nobody caught: its kind,
// a class of four words, the app's route and the app's version. Never the
// message, the stack, a file name, the address with its query, or anything
// typed into a field. Pure functions and one small reporter; the sender is
// given from outside and goes through src/client/api.ts once the institution
// server has a route for it. Until then nothing here is installed.
import { PAGES } from "./routes";

export const BROWSER_ERROR_KINDS = ["error", "unhandledrejection", "render"] as const;
export type BrowserErrorKind = (typeof BROWSER_ERROR_KINDS)[number];

export const BROWSER_ERROR_CLASSES = ["type_error", "range_error", "reference_error", "syntax_error", "other"] as const;
export type BrowserErrorClass = (typeof BROWSER_ERROR_CLASSES)[number];

export type BrowserErrorRecord = {
  readonly kind: BrowserErrorKind;
  readonly errorClass: BrowserErrorClass;
  /** A route of the app as written in routes.ts, or "other". Never the address. */
  readonly route: string;
  readonly version: string;
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

/** The route as the app names it: one of PAGES, "/" or "other". An id or a query never passes. */
export function routeName(route: string): string {
  return route === "/" || PAGES.some((page) => page.path === route) ? route : "other";
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
        const record: BrowserErrorRecord = { kind, errorClass, route: routeName(options.route()), version };
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
