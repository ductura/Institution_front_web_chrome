"use client";

import { useEffect, useState } from "react";
import { Checkbox } from "@ductura/ui";

import type { HistoryCall, SettingRead } from "./contract";
import { readWithdrawalSetting, saveWithdrawalSetting } from "./contract";
import { historyText as t } from "./messages.hr";
import { settingNote, type SettingNote } from "./model";

/**
 * The switch "Student smije povući predaju" in the assignment settings (WEB-1903; P-D3, on by
 * default). The box shows what the server holds: it changes only after the server's answer names
 * the value asked for (B-6). The assignment settings screen mounts it; it owns no route.
 */
export default function WithdrawalSwitch({ call, assignmentId, onSignedOut }: { call: HistoryCall; assignmentId: string; onSignedOut?: () => void }) {
  const [read, setRead] = useState<SettingRead | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<SettingNote | null>(null);

  useEffect(() => {
    let live = true;
    void readWithdrawalSetting(call, assignmentId).then((next) => {
      if (!live) return;
      if (next.kind === "session-expired") onSignedOut?.();
      setRead(next);
    });
    return () => { live = false; };
  }, [call, assignmentId, onSignedOut]);

  if (read === null) return <p role="status">{t.loading}</p>;
  if (read.kind !== "ready") return <p role="alert">{t.settingUnavailable}</p>;

  async function change(enabled: boolean) {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const outcome = await saveWithdrawalSetting(call, assignmentId, enabled);
    setBusy(false);
    if (outcome.kind === "spremljeno") setRead({ kind: "ready", enabled: outcome.enabled });
    const next = settingNote(outcome);
    if (next === null) onSignedOut?.();
    else setNote(next);
  }

  return (
    <div>
      <Checkbox label={t.settingLabel} hint={t.settingHint} checked={read.enabled} disabled={busy}
        onChange={(event) => void change(event.target.checked)} />
      {busy && <p role="status">{t.saving}</p>}
      {note !== null && (note.tone === "alert" ? <p role="alert">{note.text}</p> : <p role="status">{note.text}</p>)}
    </div>
  );
}
