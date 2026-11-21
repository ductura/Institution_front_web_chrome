"use client";

import { useEffect, useState, type FormEvent } from "react";

import { Button, Card, Checkbox, formatDateTime, formatNumber, isUiLocale, KeyValueList, Select, UI_LOCALES, type UiLocale } from "@ductura/ui";

import { readSession } from "../../../../../src/client/api.ts";

import {
  NOTIFICATION_KINDS, unavailableNotificationSettings, useLocale,
  type NotificationSettings, type NotificationSettingsPort,
} from "../../../src/i18n";

/** A fixed instant and number for the preview: the same on every device (21. 11. 2026., 14:05 in Zagreb). */
const SAMPLE_INSTANT = "2026-11-21T13:05:00Z";
const SAMPLE_NUMBER = 1234567.5;

type Status = { readonly tone: "status" | "alert"; readonly text: string } | null;

/**
 * Profile settings (WEB-1804, M11.5, D-70): the interface language, saved on
 * the server and shown at once without a new sign-in; how dates and numbers
 * read in it; the name from AAI@EduHr (read only); and the in-app
 * notification settings behind their port.
 */
export function ProfileSettings({ notifications = unavailableNotificationSettings }: { notifications?: NotificationSettingsPort }) {
  const { locale, server, setLocale, app } = useLocale();
  const p = app.profile;
  const [chosen, setChosen] = useState<UiLocale>(locale);
  const [saving, setSaving] = useState(false);
  const [languageStatus, setLanguageStatus] = useState<Status>(null);
  const [name, setName] = useState<string | null | undefined>(undefined);
  const [settings, setSettings] = useState<NotificationSettings | "loading" | "unavailable">("loading");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState<Status>(null);

  // The saved language may arrive after the page: the choice follows it until the person picks one.
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched) setChosen(locale);
  }, [locale, touched]);

  useEffect(() => {
    let live = true;
    void readSession().then((read) => {
      if (live) setName(read.kind === "signedIn" ? read.session.displayName : null);
    });
    void notifications.read().then((read) => {
      if (live) setSettings(read.kind === "ready" ? read.settings : "unavailable");
    });
    return () => {
      live = false;
    };
  }, [notifications]);

  const saveLanguage = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setLanguageStatus(null);
    const saved = await setLocale(chosen);
    setSaving(false);
    setTouched(false);
    if (saved.kind === "signedOut") setLanguageStatus({ tone: "alert", text: p.language.signedOut });
    else if (saved.kind === "failed") setLanguageStatus({ tone: "alert", text: p.language.failed });
    // The confirmation is read in the new language, from the catalogue it now shows.
    else setLanguageStatus({ tone: "status", text: "saved" });
  };

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault();
    if (typeof settings === "string") return;
    setSavingSettings(true);
    setSettingsStatus(null);
    const saved = await notifications.save(settings);
    setSavingSettings(false);
    if (saved.kind === "saved") {
      setSettings(saved.settings);
      setSettingsStatus({ tone: "status", text: p.notifications.saved });
    } else setSettingsStatus({ tone: "alert", text: p.notifications.failed });
  };

  const statusLine = (status: Status, savedText: string) => status === null ? null : (
    <p role={status.tone}>{status.text === "saved" ? savedText : status.text}</p>
  );

  return (
    <section className="page">
      <h1>{p.title}</h1>
      <p>{p.intro}</p>

      <Card title={p.language.heading}>
        <form onSubmit={(event) => void saveLanguage(event)}>
          <Select
            label={p.language.label}
            hint={p.language.hint}
            value={chosen}
            options={UI_LOCALES.map((value) => ({ value, label: p.language.options[value] }))}
            onChange={(event) => {
              if (isUiLocale(event.target.value)) {
                setChosen(event.target.value);
                setTouched(true);
              }
            }}
          />
          <Button type="submit" busy={saving}>{saving ? p.language.saving : p.language.save}</Button>
          {statusLine(languageStatus, p.language.saved)}
          {server === "failed" && languageStatus === null ? <p role="status">{p.language.loadFailed}</p> : null}
        </form>
      </Card>

      <Card title={p.format.heading}>
        <p>{p.format.hint}</p>
        <KeyValueList items={[
          { id: "date", label: p.format.date, value: formatDateTime(SAMPLE_INSTANT, locale) },
          { id: "number", label: p.format.number, value: formatNumber(SAMPLE_NUMBER, locale) },
        ]} />
      </Card>

      <Card title={p.name.heading}>
        <KeyValueList items={[{ id: "name", label: p.name.label, value: name === undefined ? app.host.loading : name ?? p.name.none }]} />
        <p>{p.name.hint}</p>
      </Card>

      <Card title={p.notifications.heading}>
        <p>{p.notifications.hint}</p>
        {settings === "loading" ? <p role="status">{p.notifications.loading}</p>
          : settings === "unavailable" ? <p role="status">{p.notifications.unavailable}</p>
          : (
            <form onSubmit={(event) => void saveSettings(event)}>
              {NOTIFICATION_KINDS.map((kind) => (
                <Checkbox
                  key={kind}
                  label={p.notifications.kinds[kind]}
                  checked={settings[kind]}
                  onChange={(event) => setSettings({ ...settings, [kind]: event.target.checked })}
                />
              ))}
              <Button type="submit" busy={savingSettings}>{savingSettings ? p.notifications.saving : p.notifications.save}</Button>
              {statusLine(settingsStatus, p.notifications.saved)}
            </form>
          )}
      </Card>
    </section>
  );
}
