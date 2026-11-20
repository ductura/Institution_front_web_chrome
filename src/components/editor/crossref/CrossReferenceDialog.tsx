"use client";

import { useState } from "react";
import { Button, Dialog, Select } from "@ductura/ui";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

import { numberedHeadings, type NumberedHeading } from "@/editor/chapter-numbers";
import { crossReferenceMessages as t } from "./messages.hr";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type CrossReferenceDialogProps = {
  document: ProseMirrorNode;
  onClose: () => void;
} & (
  | { mode: "insert"; onInsert: (targetId: string) => boolean }
  | { mode: "read"; targetId: string; onFollow: (targetId: string) => void; onRemove?: () => boolean }
);

function labelOf(target: NumberedHeading): string {
  return `${t.heading} ${target.number} ${target.title}`.trimEnd();
}

/** Uses the current headings to resolve the target id and the displayed number. */
export function CrossReferenceDialog(props: CrossReferenceDialogProps) {
  const [selection, setSelection] = useState("");
  const [error, setError] = useState<string>();
  const selectedId = props.mode === "insert" ? selection : props.targetId;
  const targets = numberedHeadings(props.document).filter(
    (heading): heading is NumberedHeading & { id: string } => heading.id !== null && UUID_V4.test(heading.id),
  );
  const target = targets.find((candidate) => candidate.id === selectedId);
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
            if (target) finish(props.onInsert(target.id));
          }}>{t.insert}</Button>
        : <>
            {remove && <Button tone="quiet" onClick={() => finish(remove())}>{t.remove}</Button>}
            {target && <Button onClick={() => props.onFollow(target.id)}>{t.follow}</Button>}
          </>}
    </>}>
      {props.mode === "read"
        ? <p>{target ? labelOf(target) : t.missing}</p>
        : targets.length === 0
          ? <p>{t.empty}</p>
          : <Select label={t.target} placeholder={t.choose} hint={t.hint} value={target ? selectedId : ""}
              options={targets.map((candidate) => ({ value: candidate.id, label: labelOf(candidate) }))}
              onChange={(event) => { setSelection(event.target.value); setError(undefined); }} />}
    </Dialog>
  );
}
