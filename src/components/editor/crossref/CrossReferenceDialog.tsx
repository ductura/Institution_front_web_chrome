"use client";

import { useState } from "react";
import { Button, Dialog, Select } from "@ductura/ui";

import { crossReferenceMessages as t } from "./messages.hr";

type TargetKind = "heading" | "table" | "figure";
export type CrossReference = { readonly kind: TargetKind; readonly id: string };
export type CrossReferenceTarget = CrossReference & { readonly number: string; readonly title: string };

type CrossReferenceDialogProps = {
  /** Targets projected from the current document, in reading order. */
  targets: readonly CrossReferenceTarget[];
  onClose: () => void;
} & (
  | { mode: "insert"; onInsert: (reference: CrossReference) => boolean }
  | { mode: "read"; reference: CrossReference; onFollow: (reference: CrossReference) => void; onRemove?: () => boolean }
);

function keyOf({ kind, id }: CrossReference): string {
  return `${kind}:${id}`;
}

function labelOf(target: CrossReferenceTarget): string {
  return `${t[target.kind]} ${target.number} ${target.title}`.trimEnd();
}

/** Uses the current target list, so moving a target changes its label, not its identity. */
export function CrossReferenceDialog(props: CrossReferenceDialogProps) {
  const [selection, setSelection] = useState("");
  const [error, setError] = useState<string>();
  const selectedKey = props.mode === "insert" ? selection : keyOf(props.reference);
  const target = props.targets.find((candidate) => keyOf(candidate) === selectedKey);
  const remove = props.mode === "read" ? props.onRemove : undefined;

  function finish(applied: boolean) {
    if (applied) props.onClose();
    else setError(t.unavailable);
  }

  return (
    <Dialog open title={t.title} error={error} onClose={props.onClose} actions={<>
      <Button tone="quiet" onClick={props.onClose}>{t.close}</Button>
      {props.mode === "insert"
        ? <Button disabled={!target} onClick={() => {
            if (target) finish(props.onInsert({ kind: target.kind, id: target.id }));
          }}>{t.insert}</Button>
        : <>
            {remove && <Button tone="quiet" onClick={() => finish(remove())}>{t.remove}</Button>}
            {target && <Button onClick={() => props.onFollow(props.reference)}>{t.follow}</Button>}
          </>}
    </>}>
      {props.mode === "read"
        ? <p>{target ? labelOf(target) : t.missing}</p>
        : props.targets.length === 0
          ? <p>{t.empty}</p>
          : <Select label={t.target} placeholder={t.choose} hint={t.hint} value={target ? selectedKey : ""}
              options={props.targets.map((candidate) => ({ value: keyOf(candidate), label: labelOf(candidate) }))}
              onChange={(event) => { setSelection(event.target.value); setError(undefined); }} />}
    </Dialog>
  );
}
