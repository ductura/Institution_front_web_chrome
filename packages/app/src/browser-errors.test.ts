import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { messagesHr as t } from "../../../locales/hr.ts";
import {
  createBrowserErrorReporter, errorClassOf, installBrowserErrorListeners, MAX_BROWSER_ERROR_RECORDS, PAGE_CODES, pageCode,
  type BrowserErrorRecord, type ErrorEventTarget,
} from "./browser-errors";
import ErrorBoundary from "./ErrorBoundary";
import { PAGES } from "./routes";

// DAN-1568. Invented values only; SECRET stands for text that must never leave the browser.
const SECRET = "Izmišljeni tekst rada 4f1c ana.izmisljena@student.example.invalid";

function reporter(send?: (record: BrowserErrorRecord) => unknown, route = "/zadaci") {
  const sent: BrowserErrorRecord[] = [];
  const made = createBrowserErrorReporter({
    send: send ?? ((record) => void sent.push(record)),
    route: () => route,
    version: "1.2.3",
  });
  return { sent, made };
}

describe("createBrowserErrorReporter", () => {
  it("sends the kind, the class, the page code and the version, and nothing of the error", () => {
    const { sent, made } = reporter();
    const error = Object.assign(new TypeError(SECRET), { field: SECRET, userId: "3f0e7c0a-5b1d-4c7e-9a52-0d6f1b2c3d4e" });
    expect(made.report("error", error)).toBe(true);
    expect(sent).toEqual([{ appVersion: "1.2.3", errorClass: "type_error", kind: "error", page: "assignments" }]);
    expect(Object.keys(sent[0]!)).toEqual(["appVersion", "errorClass", "kind", "page"]);
    expect(JSON.stringify(sent)).not.toContain("Izmišljeni");
    expect(JSON.stringify(sent)).not.toContain("example.invalid");
    expect(JSON.stringify(sent)).not.toContain("3f0e7c0a");
  });

  it("never sends the address: an unknown path, an id, a query or an inherited name is other", () => {
    expect(pageCode("/zadaci")).toBe("assignments");
    expect(pageCode("/")).toBe("home");
    for (const path of ["/zadaci/3f0e7c0a-5b1d-4c7e-9a52-0d6f1b2c3d4e", "/zadaci?q=" + SECRET, SECRET, "", "toString", "__proto__"]) {
      expect(pageCode(path)).toBe("other");
    }
    const { sent, made } = reporter(undefined, "/rad/" + SECRET);
    made.report("render", new Error(SECRET));
    expect(sent[0]!.page).toBe("other");
  });

  // The codes are the server's closed catalogue (Institution_server#795), written for the pages of the
  // first host. A page added since has no code there and is reported as "other" until the catalogue grows
  // (a contract matter); a code of a page that no longer exists is a stale entry and fails here.
  it("has a code only for pages of the app, every other page is \"other\", each code a plain word of the contract's form", () => {
    const paths = PAGES.map((page) => page.path);
    // "/" is the root of the app (app/(host)/page.tsx), which the host sends on to the screen of the role.
    expect(Object.keys(PAGE_CODES).filter((path) => path !== "/" && !paths.includes(path))).toEqual([]);
    for (const path of paths) expect([...Object.values(PAGE_CODES), "other"]).toContain(pageCode(path));
    const codes = Object.values(PAGE_CODES);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^[a-z_]{1,40}$/);
    expect(codes).not.toContain("other");
  });

  it("sends the same kind and class once, and at most the limit in all", () => {
    const { sent, made } = reporter();
    for (let i = 0; i < 100; i++) made.report("error", new TypeError(String(i)));
    expect(sent).toHaveLength(1);
    made.report("error", new RangeError("a"));
    made.report("error", new ReferenceError("a"));
    made.report("error", new SyntaxError("a"));
    made.report("error", "text");
    made.report("unhandledrejection", new TypeError("a"));
    made.report("render", new TypeError("a"));
    expect(sent).toHaveLength(MAX_BROWSER_ERROR_RECORDS);
  });

  it("a sender that throws, rejects or reports again starts no new error and no loop", async () => {
    const throwing = reporter(() => {
      throw new Error("send failed");
    });
    expect(() => throwing.made.report("error", new Error("x"))).not.toThrow();
    expect(throwing.made.report("error", new Error("x"))).toBe(false);

    const unhandled: unknown[] = [];
    const record = (reason: unknown) => void unhandled.push(reason);
    process.on("unhandledRejection", record);
    reporter(() => Promise.reject(new Error("offline"))).made.report("error", new Error("x"));
    await new Promise((resolve) => setTimeout(resolve, 10));
    process.off("unhandledRejection", record);
    expect(unhandled).toEqual([]);

    let calls = 0;
    const looping = createBrowserErrorReporter({
      send: () => {
        calls += 1;
        looping.report("error", new RangeError("while sending"));
        looping.report("unhandledrejection", new Error("while sending"));
      },
      route: () => "/zadaci",
      version: "1.2.3",
    });
    looping.report("error", new TypeError("x"));
    expect(calls).toBe(1);
  });

  it("a version that is not x.y.z is sent as 0.0.0, never as given", () => {
    const sent: BrowserErrorRecord[] = [];
    createBrowserErrorReporter({ send: (r) => void sent.push(r), route: () => "/", version: SECRET }).report("error", 1);
    expect(sent[0]!.appVersion).toBe("0.0.0");
  });
});

describe("errorClassOf", () => {
  it("reads the prototype only and never throws", () => {
    expect(errorClassOf(new ReferenceError("x"))).toBe("reference_error");
    const hostile = new Proxy({}, { getPrototypeOf: () => { throw new Error("trap"); } });
    for (const value of [new Error(SECRET), SECRET, null, undefined, 7, hostile]) expect(errorClassOf(value)).toBe("other");
  });
});

describe("installBrowserErrorListeners", () => {
  it("reports both events and stops when asked", () => {
    const listeners = new Map<string, (event: { error?: unknown; reason?: unknown }) => void>();
    const target: ErrorEventTarget = {
      addEventListener: (type, listener) => void listeners.set(type, listener),
      removeEventListener: (type) => void listeners.delete(type),
    };
    const { sent, made } = reporter();
    const stop = installBrowserErrorListeners(target, made);
    listeners.get("error")!({ error: new TypeError(SECRET) });
    listeners.get("unhandledrejection")!({ reason: SECRET });
    expect(sent.map((r) => `${r.kind}:${r.errorClass}`)).toEqual(["error:type_error", "unhandledrejection:other"]);
    stop();
    expect(listeners.size).toBe(0);
  });
});

describe("ErrorBoundary", () => {
  it("shows its children until a render fails, then the error screen with a retry", () => {
    expect(renderToStaticMarkup(createElement(ErrorBoundary, null, createElement("p", null, "u redu")))).toBe("<p>u redu</p>");
    expect(ErrorBoundary.getDerivedStateFromError()).toEqual({ failed: true });
    const boundary = new ErrorBoundary({ children: createElement("p", null, SECRET) });
    boundary.state = { failed: true };
    const html = renderToStaticMarkup(boundary.render());
    expect(html).toContain(t.errorPage.errorTitle);
    expect(html).toContain(t.auth.retry);
    expect(html).not.toContain("Izmišljeni");
  });

  it("tells that a render failed without the error, and survives a report that throws", () => {
    let told = 0;
    new ErrorBoundary({ children: null, onError: () => { told += 1; } }).componentDidCatch();
    expect(told).toBe(1);
    const failing = new ErrorBoundary({ children: null, onError: () => { throw new Error("report failed"); } });
    expect(() => failing.componentDidCatch()).not.toThrow();
  });
});
