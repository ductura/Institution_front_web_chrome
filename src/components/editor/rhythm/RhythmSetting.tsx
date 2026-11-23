"use client";

import { ActionRow, Button, Notice } from "@ductura/ui";
import { useEffect, useRef, useState } from "react";

import type { RhythmEraseAnswer, RhythmPort, RhythmSettingState } from "../../../client/input-rhythm";
import { inputRhythmHr as t } from "../../../lib/i18n/messages.hr";

type Erase = "idle" | "confirm" | "busy" | RhythmEraseAnswer;

/** "Zadnja promjena: nastavnik Ana Anić, 23. 11. 2026." from the answer, or null when the default holds. */
export function setByText(state: RhythmSettingState): string | null {
  if (state.changedBy === null) return null;
  const who = state.changedBy.name === null ? t.roles[state.changedBy.role] : `${t.roles[state.changedBy.role]} ${state.changedBy.name}`;
  const at = state.changedAt === null ? null : new Date(state.changedAt);
  const date = at === null || Number.isNaN(at.getTime()) ? null : `${at.getUTCDate()}. ${at.getUTCMonth() + 1}. ${at.getUTCFullYear()}`;
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
 * outcome shown is the server's answer.
 */
export function RhythmSetting({ port, documentId }: { port: RhythmPort; documentId: string }) {
  const [state, setState] = useState<RhythmSettingState | null | "loading">("loading");
  const [erase, setErase] = useState<Erase>("idle");
  const sending = useRef(false);
  useEffect(() => {
    let alive = true;
    setState("loading");
    void port.setting(documentId).then(
      (answer) => { if (alive) setState(answer.kind === "ready" ? answer.state : null); },
      () => { if (alive) setState(null); },
    );
    return () => { alive = false; };
  }, [port, documentId]);

  const confirmErase = () => {
    if (sending.current) return;
    sending.current = true;
    setErase("busy");
    void port.erase(documentId).then(
      (answer) => setErase(answer),
      () => setErase({ kind: "unavailable" }),
    ).finally(() => { sending.current = false; });
  };

  if (state === "loading") return null;
  const setBy = state === null ? null : setByText(state);
  return (
    <div data-testid="rhythm-setting">
      {state === null ? <p data-testid="rhythm-setting-unknown">{t.unknown}</p> : <>
        <p data-testid="rhythm-setting-state">{state.enabled ? t.on : t.off}</p>
        <p data-testid="rhythm-setting-level">{[state.level === null ? t.levels.unknown : t.levels[state.level], setBy].filter(Boolean).join(" ")}</p>
      </>}
      <p>{t.teacherOnly}</p>
      {erase === "confirm" || erase === "busy" ? <>
        <p data-testid="rhythm-erase-confirm">{t.erase.question}</p>
        <ActionRow>
          <Button tone="primary" busy={erase === "busy"} onClick={confirmErase}>{t.erase.confirm}</Button>
          <Button tone="quiet" disabled={erase === "busy"} onClick={() => setErase("idle")}>{t.erase.cancel}</Button>
        </ActionRow>
      </> : <ActionRow>
        <Button tone="quiet" onClick={() => setErase("confirm")}>{t.erase.button}</Button>
      </ActionRow>}
      {typeof erase === "object" && <Notice tone={erase.kind === "deleted" ? "info" : "warn"}><span data-testid="rhythm-erase-outcome">{eraseText(erase)}</span></Notice>}
    </div>
  );
}
