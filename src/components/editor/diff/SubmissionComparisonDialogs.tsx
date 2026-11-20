"use client";

import { Button, Dialog } from "@ductura/ui";
import { useRef, useState } from "react";

import { VersionComparison, type VersionComparisonProps } from "./VersionComparison";
import { comparisonHr as t } from "./messages.hr";

type Props = VersionComparisonProps & {
  mode: "submissions" | "round" | null;
  onClose: () => void;
  onCompare: () => void;
  /** Supplied by the mentor host when it has a round to review. */
  round?: { number: number; openComments?: () => void; openReview?: () => void };
};

export function SubmissionComparisonDialogs({ mode, onClose, onCompare, round, ...props }: Props) {
  const close = useRef<HTMLButtonElement>(null);
  const isRound = mode === "round" && round !== undefined;
  if (mode === null || (mode === "round" && !round)) return null;
  const title = isRound ? t.roundNumber(round.number) : t.submissions;
  return <Dialog open title={title} onClose={onClose}
    actions={<Button ref={close} tone="quiet" onClick={onClose}>{t.close}</Button>}>
    {isRound && <h3>{t.whatsNew}</h3>}
    <VersionComparison {...props} mode={isRound ? "round" : "submissions"} />
    {isRound && <>
      <Button onClick={() => { close.current?.focus(); onCompare(); }}>{t.submissions}</Button>
      {round.openComments && <Button tone="quiet" onClick={() => { onClose(); round.openComments?.(); }}>{t.openComments}</Button>}
      {round.openReview && <Button tone="quiet" onClick={() => { onClose(); round.openReview?.(); }}>{t.openReview}</Button>}
    </>}
  </Dialog>;
}

export function SubmissionComparisonActions(props: Omit<Props, "mode" | "onClose" | "onCompare">) {
  const [mode, setMode] = useState<Props["mode"]>(null);
  return <>
    <Button tone="quiet" onClick={() => setMode("submissions")}>{t.submissions}</Button>
    {props.round && <Button tone="quiet" onClick={() => setMode("round")}>{t.round}</Button>}
    <SubmissionComparisonDialogs {...props} mode={mode} onClose={() => setMode(null)} onCompare={() => setMode("submissions")} />
  </>;
}
