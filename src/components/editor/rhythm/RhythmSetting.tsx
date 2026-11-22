"use client";

import { Checkbox } from "@ductura/ui";
import { useEffect, useState } from "react";

import type { RhythmPort } from "@/client/input-rhythm";
import { inputRhythmHr as t } from "@/lib/i18n/messages.hr";

/**
 * "Bilježi ritam tipkanja" for the dialog "Što Ductura bilježi dok pišeš" and the settings
 * (WEB-0910). The value is the setting of the work as the port reports it. Only a teacher
 * changes it (P-1: "isključuje ga SAMO nastavnik"); for a student the box is read-only with
 * the reason beside it, and nothing is written.
 */
export function RhythmSetting({ port, documentId, canChange, onChange }: {
  port: RhythmPort;
  documentId: string;
  canChange: boolean;
  /** Called only when `canChange` and the box is toggled; the teacher's adapter writes it. */
  onChange?: (on: boolean) => void;
}) {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    void port.recording(documentId).then((v) => { if (alive) setOn(v); }, () => { if (alive) setOn(null); });
    return () => { alive = false; };
  }, [port, documentId]);
  if (on === null) return <p data-testid="rhythm-setting-unknown">{t.unknown}</p>;
  return (
    <div data-testid="rhythm-setting">
      <Checkbox
        label={t.toggle}
        checked={on}
        disabled={!canChange}
        onChange={() => { if (canChange) { setOn(!on); onChange?.(!on); } }}
      />
      {!canChange && <p>{t.teacherOnly}</p>}
    </div>
  );
}
