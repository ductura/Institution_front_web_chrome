"use client";

// WEB-NUZ-PREDAJA-2 (NF-3 PR-9): the browser's side of recheck.ts. While `active`, the state of the
// submission is read 10 s after the outcome turned unknown, again 10 s after each read that did not
// answer, and whenever the connection comes back; "Provjeri stanje predaje" is one more read of the
// same count. A read that answers hands the state on and stops the rechecks.
import { useCallback, useEffect, useRef, useState } from "react";

import type { SubmissionRead } from "../../../../../../../src/client/submission";
import { RECHECK_AFTER_MS, RECHECK_START, afterUnanswered, answered, startRead, type RecheckState } from "./recheck";

export function useRecheck(active: boolean, read: () => Promise<SubmissionRead>, onAnswer: (state: SubmissionRead) => void): {
  readonly state: RecheckState;
  readonly readNow: () => void;
} {
  const [state, setState] = useState<RecheckState>(RECHECK_START);
  const current = useRef(state);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const run = useRef<() => void>(() => undefined);
  const latest = useRef({ read, onAnswer });
  useEffect(() => { latest.current = { read, onAnswer }; });

  const set = (next: RecheckState) => { current.current = next; setState(next); };
  const clear = () => { if (timer.current !== null) clearTimeout(timer.current); timer.current = null; };

  useEffect(() => {
    if (!active) return undefined;
    let live = true;
    set(RECHECK_START);
    const schedule = () => { clear(); timer.current = setTimeout(() => run.current(), RECHECK_AFTER_MS); };
    run.current = () => {
      const started = startRead(current.current);
      if (started === null) return;
      clear();
      set(started);
      void latest.current.read().catch((): SubmissionRead => ({ kind: "nepoznato" })).then((state) => {
        if (!live) return;
        if (answered(state)) {
          set({ ...current.current, reading: false });
          latest.current.onAnswer(state);
          return;
        }
        const next = afterUnanswered(current.current);
        set(next);
        if (!next.gaveUp) schedule();
      });
    };
    const online = () => run.current();
    schedule();
    window.addEventListener("online", online);
    return () => {
      live = false;
      clear();
      window.removeEventListener("online", online);
      run.current = () => undefined;
    };
  }, [active]);

  const readNow = useCallback(() => run.current(), []);
  return { state, readNow };
}
