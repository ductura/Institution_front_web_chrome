"use client";

// ED-113 (prototype tools.js "Kostur za obranu"): "Složi iz rada" composes the outline in the browser from
// the work and its thread; the student edits it and copies it. The outline stays on this device only and is
// never sent: nothing here reaches the mentor or the server.
import { ActionRow, Button, TextArea } from "@ductura/ui";
import { useState } from "react";

import { EMPTY_THREAD, parseThread } from "../left/left-model";
import { useDeviceValue } from "../left/use-left";

import { defenseInputOf, defenseText, parseDefense, type DefenseNode } from "./defense-model";
import { mentorCardHr } from "./messages.hr";

const t = mentorCardHr.defense;

type Note = "copied" | "copyFailed" | null;

export function DefensePanel({ workId, doc, onCopy }: {
  /** The key of the left panel's thread (the assignment), so the question is the one the student wrote. */
  workId: string;
  /** The open document at the moment of composing; null while the editor is not ready. */
  doc: () => DefenseNode | null;
  onCopy?: (text: string) => Promise<boolean>;
}) {
  const [thread] = useDeviceValue("thread", workId, parseThread, EMPTY_THREAD);
  const [saved, save] = useDeviceValue("defense", workId, parseDefense, null);
  const [unsaved, setUnsaved] = useState(false);
  const [note, setNote] = useState<Note>(null);

  const keep = (text: string) => { setUnsaved(!save(text)); };
  const make = () => {
    const now = doc();
    if (now === null) return;
    setNote(null);
    keep(defenseText(defenseInputOf(now, thread.question)));
  };
  const copy = async (text: string) => {
    const ok = await (onCopy?.(text) ?? Promise.resolve(false)).catch(() => false);
    setNote(ok ? "copied" : "copyFailed");
  };

  return (
    <div data-defense-panel="">
      <p>{t.intro}</p>
      {saved === null ? <p role="status">{t.empty}</p> : (
        <>
          <TextArea label={t.edit} rows={14} value={saved} onChange={(e) => keep(e.currentTarget.value)} />
          {onCopy && <ActionRow><Button size="dense" tone="secondary" onClick={() => void copy(saved)}>{t.copy}</Button></ActionRow>}
        </>
      )}
      <Button size="dense" tone="quiet" onClick={make}>{saved === null ? t.make : t.remake}</Button>
      {unsaved && <p role="status">{t.unsaved}</p>}
      {note === "copied" && <p role="status">{t.copied}</p>}
      {note === "copyFailed" && <p role="alert">{t.copyFailed}</p>}
    </div>
  );
}
