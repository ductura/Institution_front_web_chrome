"use client";

import { useEffect, useState } from "react";
import { Button, Dialog, KeyValueList } from "@ductura/ui";

import { readInstitutionCitationSettings } from "./institution-citation-settings";
import { workPartsMessages as t } from "./messages.hr";

export function EditorCitationSettings({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof readInstitutionCitationSettings>> | null>(null);
  useEffect(() => {
    let live = true;
    void readInstitutionCitationSettings().then((value) => { if (live) setSettings(value); });
    return () => { live = false; };
  }, []);
  return (
    <Dialog open title={t.citationTitle} onClose={onClose} actions={<Button onClick={onClose}>{t.close}</Button>}>
      {settings ? <KeyValueList items={[
        { id: "style", label: t.style, value: t.citationStyles.get(settings.styleId) ?? settings.styleId },
        { id: "profile", label: t.profile, value: settings.profileId === "fpzg-opci-akademski-rad"
          ? t.defaultProfile : settings.profileId ?? t.profileUnavailable },
      ]} /> : <p role="status">{t.loadingSettings}</p>}
      {settings && <p data-style-note="">{t.styleByInstitution}</p>}
      {settings && !settings.formattingStyle && <p role="status">{t.unsupportedStyle}</p>}
    </Dialog>
  );
}
