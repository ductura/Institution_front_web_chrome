// WEB-V21-KOD-POKRETANJE: the frame page of the code runner. It is loaded by `src` (never `srcdoc`) in an iframe with
// sandbox="allow-scripts" (opaque origin, no cookies, no storage) under its own CSP:
//   default-src 'none'; script-src 'self'; worker-src blob:; frame-ancestors 'self'   (set by PL-CSP-OKVIR).
// This one script only creates a Worker per test and passes messages. The student's code is part of the Worker's own
// source text (a blob), never eval'd, because `script-src 'self'` forbids eval. The Worker has no `connect-src`
// (inherited `default-src 'none'`), and its network globals are also removed before the student's code runs.
// Nothing is sent anywhere: the answer goes only to the parent window.
"use strict";
(function () {
  var TIMEOUT_MS = 2000;
  var MAX_TESTS = 10;

  // Runs before the student's code (top of the Worker source).
  var PRELUDE = [
    "'use strict';",
    "var __post = self.postMessage.bind(self);",
    "['fetch','XMLHttpRequest','WebSocket','EventSource','WebTransport','importScripts','Worker','SharedWorker','Request','Response','BroadcastChannel','indexedDB','caches','navigator']",
    ".forEach(function (n) { try { Object.defineProperty(self, n, { value: undefined, writable: false, configurable: false }); } catch (e) {} });",
    ""
  ].join("\n");

  // Runs after the student's code: calls `solve(input)` and compares with `expected`.
  var RUNNER = [
    "",
    ";(async function () {",
    "  function eq(a, b) {",
    "    if (Object.is(a, b) || a === b) return true;",
    "    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;",
    "    if (Array.isArray(a) !== Array.isArray(b)) return false;",
    "    var ka = Object.keys(a), kb = Object.keys(b);",
    "    if (ka.length !== kb.length) return false;",
    "    return ka.every(function (k) { return Object.prototype.hasOwnProperty.call(b, k) && eq(a[k], b[k]); });",
    "  }",
    "  var run = self.__ductura_test;",
    "  if (typeof solve !== 'function') { __post({ kind: 'no-solve' }); return; }",
    "  try {",
    "    var actual = await solve(run.input);",
    "    var same = eq(actual, run.expected);",
    "    var plain = null; try { plain = JSON.parse(JSON.stringify(actual === undefined ? null : actual)); } catch (e) { if (same) plain = run.expected; else { __post({ kind: 'error', message: 'Rezultat se ne može prikazati.' }); return; } }",
    "    __post({ kind: same ? 'passed' : 'failed', actual: plain });",
    "  } catch (e) {",
    "    __post({ kind: 'error', message: String(e && e.message ? e.message : e).slice(0, 300) });",
    "  }",
    "})();"
  ].join("\n");

  function runOne(code, test, done) {
    var source = PRELUDE + "self.__ductura_test = " + JSON.stringify({ input: test.input, expected: test.expected }).replace(/</g, "\\u003c") + ";\n" + code + RUNNER;
    var url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    var worker;
    var finished = false;
    var timer;
    function finish(result) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try { worker.terminate(); } catch (e) {}
      URL.revokeObjectURL(url);
      done(result);
    }
    try { worker = new Worker(url); } catch (e) { finish({ kind: "error", message: "Pokretanje nije dostupno." }); return; }
    timer = setTimeout(function () { finish({ kind: "timeout" }); }, TIMEOUT_MS);
    worker.onmessage = function (event) {
      var d = event.data;
      if (d && typeof d === "object" && typeof d.kind === "string") finish(d); else finish({ kind: "error", message: "Neispravan odgovor." });
    };
    worker.onerror = function (event) {
      if (event && event.preventDefault) event.preventDefault();
      finish({ kind: "error", message: String(event && event.message ? event.message : "Greška u kodu").slice(0, 300) });
    };
  }

  // Fail closed: without the frame's own CSP (script-src 'self') eval would be allowed, and nothing would stop the
  // code from reaching the network. Nothing runs then.
  function policyHolds() {
    try { (new Function("return 1"))(); return false; } catch (e) { return true; }
  }

  function runAll(request) {
    if (!policyHolds()) { parent.postMessage({ type: "results", runId: request.runId, blocked: true, results: [] }, "*"); return; }
    var results = [];
    var missing = false;
    var i = 0;
    (function next() {
      if (i >= request.tests.length || missing) {
        parent.postMessage({ type: "results", runId: request.runId, missingSolve: missing, results: missing ? [] : results }, "*");
        return;
      }
      var test = request.tests[i];
      runOne(request.code, test, function (r) {
        if (r.kind === "no-solve") missing = true;
        else results.push({ id: test.id, status: r.kind, actual: r.actual, message: r.message });
        i += 1;
        next();
      });
    })();
  }

  window.addEventListener("message", function (event) {
    if (event.source !== parent) return;
    var d = event.data;
    if (!d || d.type !== "run" || typeof d.runId !== "string" || typeof d.code !== "string" || !Array.isArray(d.tests) || d.tests.length > MAX_TESTS) return;
    runAll({ runId: d.runId, code: d.code, tests: d.tests });
  });
  parent.postMessage({ type: "ready" }, "*");
})();
