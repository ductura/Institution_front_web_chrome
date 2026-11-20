"use client";

import { useState } from "react";
import { Button, Dialog, Select, type SelectOption } from "@ductura/ui";

import { workPartsMessages as t } from "./messages.hr";

export type CitationSettings = { readonly styleId: string; readonly profileId: string };

type CitationSettingsDialogProps = {
  /** Resolved values and allowed options supplied by the institution's settings. */
  value: CitationSettings;
  styles: readonly SelectOption[];
  profiles: readonly SelectOption[];
  onApply: (settings: CitationSettings) => boolean;
  onClose: () => void;
};

export function CitationSettingsDialog({ value, styles, profiles, onApply, onClose }: CitationSettingsDialogProps) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string>();
  const hasStyles = styles.length > 0;
  const hasProfiles = profiles.length > 0;
  const available = hasStyles || hasProfiles;
  const styleValid = !hasStyles || styles.some((option) => option.value === draft.styleId);
  const profileValid = !hasProfiles || profiles.some((option) => option.value === draft.profileId);
  const changed = draft.styleId !== value.styleId || draft.profileId !== value.profileId;

  return (
    <Dialog open title={t.citationTitle} error={error} onClose={onClose} actions={<>
      <Button tone="quiet" onClick={onClose}>{t.cancel}</Button>
      <Button disabled={!available || !styleValid || !profileValid || !changed}
        onClick={() => { if (onApply(draft)) onClose(); else setError(t.applyError); }}>{t.done}</Button>
    </>}>
      {available ? <>
        {hasStyles && <Select label={t.style} options={styles} placeholder={t.chooseStyle}
          value={styleValid ? draft.styleId : ""}
          onChange={(event) => { setDraft({ ...draft, styleId: event.target.value }); setError(undefined); }} />}
        {hasProfiles && <Select label={t.profile} options={profiles} placeholder={t.chooseProfile}
          value={profileValid ? draft.profileId : ""}
          onChange={(event) => { setDraft({ ...draft, profileId: event.target.value }); setError(undefined); }} />}
      </> : <p>{t.settingsUnavailable}</p>}
    </Dialog>
  );
}
