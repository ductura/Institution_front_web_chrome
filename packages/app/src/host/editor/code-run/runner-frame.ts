// WEB-V21-KOD-POKRETANJE: drives the sandboxed frame. The iframe has sandbox="allow-scripts" and no
// allow-same-origin, so it has an opaque origin (no cookies, no storage) and loads the static frame page by `src`.
// It is created for one run and removed afterwards; nothing it does reaches the server.
import { MAX_CODE_CHARS, MAX_RUN_TESTS, RUN_TIMEOUT_MS, parseFrameAnswer, type CodeTest, type RunOutcome } from "./runner.ts";

export const CODE_RUN_FRAME_PATH = "/app/code-run/frame.html";

let counter = 0;

/** Runs `code` against `tests` in a fresh frame; resolves with the outcome, never rejects. */
export function runInFrame(code: string, tests: readonly CodeTest[], doc: Document = document, frameSrc: string = CODE_RUN_FRAME_PATH): Promise<RunOutcome> {
  if (tests.length === 0 || tests.length > MAX_RUN_TESTS || code.length > MAX_CODE_CHARS) return Promise.resolve({ kind: "failed" });
  counter += 1;
  const runId = `run-${counter}-${Math.random().toString(36).slice(2)}`;
  return new Promise<RunOutcome>((resolve) => {
    const frame = doc.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.hidden = true;
    frame.src = frameSrc;
    const view = doc.defaultView!;
    let timer: ReturnType<typeof setTimeout>;
    const done = (outcome: RunOutcome) => {
      clearTimeout(timer);
      view.removeEventListener("message", onMessage);
      frame.remove();
      resolve(outcome);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow) return;
      const data = event.data as { type?: unknown } | null;
      if (data && data.type === "ready") {
        frame.contentWindow!.postMessage({ type: "run", runId, code, tests: tests.map(({ id, input, expected }) => ({ id, input, expected })) }, "*");
        return;
      }
      const answer = parseFrameAnswer(event.data, runId, tests);
      if (answer) done(answer);
    };
    view.addEventListener("message", onMessage);
    // A frame that never answers (blocked page, missing CSP allowance) ends the run; the tests have their own 2 s each.
    timer = setTimeout(() => done({ kind: "failed" }), tests.length * RUN_TIMEOUT_MS + 3000);
    doc.body.append(frame);
  });
}
