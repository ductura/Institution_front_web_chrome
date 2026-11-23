"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Checkbox } from "@ductura/ui";

import type { RhythmAnswer, RhythmState, RhythmSwitchPort } from "../../../../../../src/client/input-rhythm-teacher";
import { rhythmSwitchHr as text } from "./messages.hr";
import { canReset, changeNote, sourceText, type RhythmLevel, type RhythmNote } from "./model";

/**
 * The switch "Bilježi ritam tipkanja" (PIL-P1-RITAM-NASTAVNIK). The box shows what the server holds and
 * changes only on its confirmation (B-6); one change at a time, a second click while one is out sends nothing
 * (the box stays focusable, aria-disabled, so the keyboard focus is kept).
 * `refresh` asks again (the course's switch changed); `name` tells one assignment's switch from another.
 */
export function RhythmSwitch({ level, port, name, refresh = 0, onSignedOut, onChanged }: {
  level: RhythmLevel; port: RhythmSwitchPort; name?: string; refresh?: number;
  onSignedOut: () => void; onChanged?: () => void;
}) {
  const [read, setRead] = useState<RhythmAnswer | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<RhythmNote | null>(null);
  const out = useRef(false);
  const sends = useRef(0);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    let current = true;
    // The shown state stays until the new read answers (no flicker on a refresh). A read that started
    // before a change, or answers while one is out, is dropped: the change's own answer is the last word (N4).
    const before = sends.current;
    void port.read().then((answer) => {
      if (!current || out.current || sends.current !== before) return;
      if (answer.kind === "signedOut") onSignedOut();
      setRead(answer);
    });
    return () => { current = false; live.current = false; };
  }, [port, refresh, attempt, onSignedOut]);

  async function send(request: () => Promise<RhythmAnswer>) {
    if (out.current) return;
    out.current = true;
    sends.current += 1;
    setBusy(true);
    setNote(null);
    const answer = await request();
    out.current = false;
    // Counted at both ends: a read started while this change was out is older than its answer.
    sends.current += 1;
    if (!live.current) return;
    setBusy(false);
    const next = changeNote(answer);
    if (next === null) return onSignedOut();
    setNote(next);
    if (answer.kind === "ready") {
      setRead(answer);
      onChanged?.();
    }
  }

  if (read === null || read.kind === "signedOut") return <p className="meta" role="status">{text.loading}</p>;
  if (read.kind === "unavailable") {
    return (
      <div>
        <p className="meta" role="alert">{text.unavailable}</p>
        <Button tone="secondary" size="small" onClick={() => setAttempt((n) => n + 1)}>{text.retry}</Button>
      </div>
    );
  }
  const state: RhythmState = read.state;
  return (
    <div data-rhythm-level={level} data-rhythm-source={state.source}>
      <Checkbox label={text.label} aria-label={name ? text.labelFor(name) : undefined} hint={sourceText(level, state)}
        checked={state.enabled} aria-disabled={busy || undefined} aria-busy={busy || undefined} onChange={(event) => void send(() => port.set(event.target.checked))} />
      {canReset(level, state) && port.reset !== undefined ? (
        <Button tone="secondary" size="small" busy={busy} aria-label={name ? text.resetFor(name) : undefined}
          onClick={() => void send(port.reset!)}>{text.reset}</Button>
      ) : null}
      {busy && <p className="meta" role="status">{text.saving}</p>}
      {note !== null && <p className="meta" role={note.tone}>{note.text}</p>}
    </div>
  );
}
