"use client";

import { ActionRow, Button } from "@ductura/ui";
import { useEffect, useRef, useState } from "react";

import type { RhythmEraseAnswer, RhythmPort, RhythmSettingAnswer, RhythmSettingState } from "../../../client/input-rhythm";
import { inputRhythmHr as t } from "../../../lib/i18n/messages.hr";
import { rhythmErased } from "./erased";

type Erase = "idle" | "confirm" | "busy" | RhythmEraseAnswer;

/** The faculty's calendar day: a change at 00:30 in Zagreb is that day, not the UTC one before. */
const DAY = new Intl.DateTimeFormat("hr-HR", { timeZone: "Europe/Zagreb", day: "numeric", month: "numeric", year: "numeric" });

/** "Zadnja promjena: nastavnik Ana Anić, 23. 11. 2026." from the answer, or null when the default holds. */
export function setByText(state: RhythmSettingState): string | null {
  if (state.changedBy === null) return null;
  const who = state.changedBy.name === null ? t.roles[state.changedBy.role] : `${t.roles[state.changedBy.role]} ${state.changedBy.name}`;
  const at = state.changedAt === null ? null : new Date(state.changedAt);
  const date = at === null || Number.isNaN(at.getTime()) ? null : DAY.format(at).replace(/\.$/, "");
  return t.setBy.replace("{who}", date === null ? who : `${who}, ${date}`);
}

/** What one erase answer says to the student. */
export function eraseText(answer: RhythmEraseAnswer): string {
  if (answer.kind === "signedOut") return t.erase.signedOut;
  if (answer.kind === "unavailable") return t.erase.failed;
  return answer.count === 0 ? t.erase.none : t.erase.done.replace("{count}", String(answer.count));
}

/**
 * "Bilježi ritam tipkanja" in the dialog "Što Ductura bilježi dok pišeš" (PIL-P1-RITAM-PREKIDAC).
 * The state is the server's setting of the work; only a teacher changes it, per course or per
 * assignment (Daniel 22. and 23. 11. 2026.), so the student sees it with its level and who set it,
 * and no switch. The student may delete what was recorded: only after a confirmation, and the
 * outcome shown is the server's answer. An ended session is said as such, without leaving the page
 * (unsaved writing stays where it is).
 */
export function RhythmSetting({ port, documentId }: { port: RhythmPort; documentId: string }) {
  const [answer, setAnswer] = useState<RhythmSettingAnswer | "loading">("loading");
  const [erase, setErase] = useState<Erase>("idle");
  const sending = useRef(false);
  const eraseButton = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    let alive = true;
    setAnswer("loading");
    void port.setting(documentId).then(
      (next) => { if (alive) setAnswer(next); },
      () => { if (alive) setAnswer({ kind: "unavailable" }); },
    );
    return () => { alive = false; };
  }, [port, documentId]);
  // Focus follows the step the student is in: the question's "Odustani", then back to the button.
  useEffect(() => {
    if (!moved.current) return;
    if (erase === "confirm") cancelButton.current?.focus();
    else if (erase === "idle" || typeof erase === "object") eraseButton.current?.focus();
  }, [erase]);
  const step = (next: Erase) => { moved.current = true; setErase(next); };

  const confirmErase = () => {
    if (sending.current) return;
    sending.current = true;
    step("busy");
    rhythmErased(documentId);
    void port.erase(documentId).then(
      (outcome) => step(outcome),
      () => step({ kind: "unavailable" }),
    ).finally(() => { sending.current = false; });
  };

  if (answer === "loading") return null;
  if (answer.kind === "signedOut") return <p role="alert" data-testid="rhythm-setting-signed-out">{t.signedOut}</p>;
  const state = answer.kind === "ready" ? answer.state : null;
  const setBy = state === null ? null : setByText(state);
  const asking = erase === "confirm" || erase === "busy";
  return (
    <div data-testid="rhythm-setting">
      {state === null ? <p data-testid="rhythm-setting-unknown">{t.unknown}</p> : <>
        <p data-testid="rhythm-setting-state">{state.enabled ? t.on : t.off}</p>
        <p data-testid="rhythm-setting-level">{[state.level === null ? t.levels.unknown : t.levels[state.level], setBy].filter(Boolean).join(" ")}</p>
      </>}
      <p>{t.teacherOnly}</p>
      {asking ? <>
        <p id={`rhythm-erase-question-${documentId}`} data-testid="rhythm-erase-confirm">{t.erase.question}</p>
        <ActionRow>
          <Button tone="primary" busy={erase === "busy"} aria-describedby={`rhythm-erase-question-${documentId}`} onClick={confirmErase}>{t.erase.confirm}</Button>
          <Button tone="quiet" ref={cancelButton} disabled={erase === "busy"} aria-describedby={`rhythm-erase-question-${documentId}`} onClick={() => step("idle")}>{t.erase.cancel}</Button>
        </ActionRow>
      </> : <ActionRow>
        <Button tone="quiet" ref={eraseButton} onClick={() => step("confirm")}>{t.erase.button}</Button>
      </ActionRow>}
      {/* The live region is there from the start; only its text changes, so the outcome is read out. */}
      <p role="status" data-testid="rhythm-erase-outcome">{typeof erase === "object" ? eraseText(erase) : ""}</p>
    </div>
  );
}
