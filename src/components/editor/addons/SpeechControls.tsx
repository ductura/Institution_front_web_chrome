"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@ductura/ui";

import { addonsMessages as t } from "./messages.hr";
import styles from "./SpeechControls.module.css";
import { readAloud, speechSupport, startDictation, stopReading, type DictationEnd } from "./speech";

type Props = {
  /** Text to read: the selection, else the current paragraph. */
  getText: () => string;
  /** A final dictated phrase, to insert at the cursor. */
  onPhrase: (phrase: string) => void;
  editable: boolean;
  /** False when reading aloud is offered elsewhere (the toolbar's "Čitaj naglas" menu): only dictation shows. */
  reading?: boolean;
};

export function SpeechControls({ getText, onPhrase, editable, reading: showReading = true }: Props) {
  const [support, setSupport] = useState<{ dictation: boolean; reading: boolean } | null>(null);
  const [dictating, setDictating] = useState(false);
  const [reading, setReading] = useState(false);
  const [note, setNote] = useState("");
  /** Which failure the note says (it is red; only a failed dictation offers "Pokušaj ponovno"). */
  const [failure, setFailure] = useState<"denied" | "failed" | null>(null);
  const stop = useRef<(() => void) | null>(null);

  const phrase = useRef(onPhrase);
  phrase.current = onPhrase;
  const canEdit = useRef(editable);
  canEdit.current = editable;
  useEffect(() => { if (!editable) stop.current?.(); }, [editable]);
  useEffect(() => { setSupport(speechSupport()); return () => { stop.current?.(); stopReading(); }; }, []);
  if (support === null) return null;
  const canDictate = support.dictation;
  const canRead = showReading && support.reading;
  if (!canDictate && !canRead) return showReading ? <p role="status" className={styles.error}>{t.unsupported}</p> : null;

  const toggleDictation = () => {
    if (dictating) return stop.current?.();
    const end = (reason: DictationEnd) => {
      setDictating(false); stop.current = null;
      setNote(reason === "denied" ? t.denied : reason === "failed" ? t.failed : "");
      setFailure(reason === "denied" || reason === "failed" ? reason : null);
    };
    stop.current = startDictation((text) => { if (canEdit.current) phrase.current(text); }, end);
    if (stop.current) { setDictating(true); setNote(t.dictating); setFailure(null); }
  };
  const toggleReading = () => {
    if (reading) { stopReading(); return setReading(false); }
    setReading(readAloud(getText(), () => setReading(false)));
    setFailure(null);
    if (!getText().trim()) setNote(t.readEmpty); else setNote("");
  };

  return (
    <div role="group" aria-label={t.local}>
      {canDictate && editable ? <Button tone="quiet" aria-pressed={dictating} onClick={toggleDictation}>{dictating ? t.dictateStop : t.dictate}</Button> : null}
      {canRead ? <Button tone="quiet" aria-pressed={reading} onClick={toggleReading}>{reading ? t.readStop : t.read}</Button> : null}
      <p role="status" className={failure ? styles.error : undefined}>{note}</p>
      {failure === "failed" && canDictate && editable
        ? <p><button type="button" className={styles.retry} onClick={toggleDictation}>{t.retry}</button></p> : null}
    </div>
  );
}
