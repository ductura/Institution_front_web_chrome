"use client";

// WEB-V21-KOD-POKRETANJE: „Pokreni testove” uz blok koda (jezik javascript) i prikaz rezultata samo studentu.
// `CodeRunMount` čita testove zadatka (port), daje bloku akciju preko plugina `codeViewPlugin` i otvara dijalog s
// rezultatom po testu. Ništa se ne šalje, ne zapisuje i ne pokazuje nastavniku.
import { useLocalEditor } from "@/components/editor/LocalDocument";
import { Button, Dialog } from "@ductura/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { codeViewKey, codeViewPlugin, type CodeBlockActions, type CodeBlockInfo } from "../code-block/code-view.ts";
import { codeRunHr as t } from "./messages.hr.ts";
import { readCodeTests, type CodeTestsRead, type ReadCodeTests } from "./port.ts";
import { RUN_TIMEOUT_MS, countPassed, show, type CodeTest, type RunOutcome } from "./runner.ts";
import { runInFrame } from "./runner-frame.ts";

type Shown = { state: "running" } | { state: "done"; tests: readonly CodeTest[]; outcome: RunOutcome } | { state: "unavailable" };

/** What the dialog holds for one run (exported for the DOM test). */
export function CodeRunResult({ shown, onClose, onRetry }: { shown: Shown | null; onClose: () => void; onRetry: () => void }) {
  if (!shown) return null;
  const outcome = shown.state === "done" ? shown.outcome : null;
  const error = shown.state === "unavailable" ? t.unavailable : outcome?.kind === "failed" ? t.frameFailed : outcome?.kind === "missing-solve" ? t.missingSolve : undefined;
  return (
    <Dialog open title={t.title} onClose={onClose} error={error}
      actions={<>
        {error && shown.state !== "running" ? <Button type="button" tone="quiet" onClick={onRetry}>{t.retry}</Button> : null}
        <Button type="button" onClick={onClose}>{t.close}</Button>
      </>}>
      <p>{t.notice}</p>
      {shown.state === "running" ? <p role="status">{t.running}</p> : null}
      {shown.state === "done" && outcome?.kind === "results" ? (
        <>
          <p role="status">{t.summary(countPassed(outcome.results), outcome.results.length)}</p>
          <ul>
            {outcome.results.map((r, i) => (
              <li key={r.id}>
                <strong>{shown.tests[i]!.title}</strong>: {t.status[r.status]}
                {r.status === "failed" ? <div>{t.expected}: <code>{show(shown.tests[i]!.expected)}</code>; {t.actual}: <code>{show(r.actual)}</code></div> : null}
                {r.status === "timeout" ? <div>{t.timedOut(RUN_TIMEOUT_MS / 1000)}</div> : null}
                {r.status === "error" && r.message ? <div>{r.message}</div> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Dialog>
  );
}

/** Mounted next to the toolbar: gives javascript blocks the „Pokreni testove” action and shows the result. */
export function CodeRunMount({ assignmentId, read = readCodeTests, readTests, runner = runInFrame }: {
  assignmentId: string; read?: typeof readCodeTests; readTests?: ReadCodeTests; runner?: typeof runInFrame;
}) {
  const editor = useLocalEditor();
  const [loaded, setLoaded] = useState<CodeTestsRead | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const last = useRef<CodeBlockInfo | null>(null);
  const token = useRef(0);

  const load = useCallback(async () => {
    const result = await read(assignmentId, readTests);
    setLoaded(result);
    return result;
  }, [assignmentId, read, readTests]);
  useEffect(() => { void load(); }, [load]);

  const run = useCallback(async (block: CodeBlockInfo, from: CodeTestsRead | null) => {
    last.current = block;
    const mine = ++token.current;
    setShown({ state: "running" });
    const current = from?.kind === "ready" ? from : await load();
    if (mine !== token.current) return;
    if (current.kind !== "ready") { setShown({ state: "unavailable" }); return; }
    const outcome = await runner(block.code, current.tests);
    if (mine === token.current) setShown({ state: "done", tests: current.tests, outcome });
  }, [load, runner]);

  const actions = useMemo<CodeBlockActions>(() => (block) => {
    if (block.language !== "javascript" || !loaded || loaded.kind === "none") return [];
    return [{ id: "run-tests", label: t.run, run: () => { void run(block, loaded); } }];
  }, [loaded, run]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    // The toolbar registers the same plugin without actions; this replaces it with one that has them.
    editor.unregisterPlugin(codeViewKey);
    editor.registerPlugin(codeViewPlugin(() => actions));
    return () => { if (!editor.isDestroyed) editor.unregisterPlugin(codeViewKey); };
  }, [editor, actions]);

  return <CodeRunResult shown={shown} onClose={() => { token.current += 1; setShown(null); }}
    onRetry={() => { if (last.current) void run(last.current, null); }} />;
}
