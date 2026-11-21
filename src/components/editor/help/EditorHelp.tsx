"use client";

import { Button, Checkbox, Dialog } from "@ductura/ui";
import { useEffect, useState, type ReactNode } from "react";

import { editorHelpHr as t } from "../../../lib/i18n/messages.hr";
import { defaultHelp, forLevel, levelOf, readHelp, settingsKey, toggleWarning, warningKeys, warnings, type HelpSettings, type Level, type Warning } from "./preferences";
import styles from "./EditorHelp.module.css";

export function useEditorHelp() {
  const [settings, setSettings] = useState(defaultHelp);
  useEffect(() => setSettings(readHelp(() => localStorage.getItem(settingsKey))), []);
  const save = (next: HelpSettings) => {
    setSettings(next);
    try { localStorage.setItem(settingsKey, JSON.stringify(next)); } catch { /* The changes work for this page. */ }
  };
  return {
    ...settings,
    choose: (level: Level) => save({ level, enabled: forLevel(level, settings.enabled) }),
    toggle: (key: Warning) => {
      const enabled = toggleWarning(settings.enabled, key);
      save({ enabled, level: levelOf(enabled) });
    },
  } as const;
}

export type EditorHelpView = "writing" | "firstSentence" | "recorded";
type Notice = {
  course: string;
  title: string;
  due?: string;
  length?: { min: number; max: number };
  /** Published instructions and permitted tools for this assignment. */
  instructions: ReactNode;
};

type Props = {
  view: EditorHelpView | null;
  onClose: () => void;
  help: ReturnType<typeof useEditorHelp>;
  counts?: Partial<Record<Warning, number>>;
  notice?: Notice;
  /** The work surface still passes this from the previous first-run hint. */
  fresh?: boolean;
};

export function EditorHelpDialogs({ view, onClose, help, counts, notice }: Props) {
  const close = <Button tone="quiet" onClick={onClose}>{t.close}</Button>;
  return <>
    <Dialog open={view === "writing"} title={t.settingsTitle} actions={close} onClose={onClose}>
      <p className={styles.quiet}>{t.settingsIntro}</p>
      <div className={styles.levels}>
        {(Object.keys(t.levels) as Level[]).map((level) => (
          <Button key={level} tone="quiet" aria-pressed={help.level === level} onClick={() => help.choose(level)}>
            {t.levels[level]}
          </Button>
        ))}
      </div>
      {warningKeys.map((key) => {
        const [label, hint] = warnings[key];
        const count = counts?.[key];
        return <Checkbox key={key} label={label} checked={help.enabled.includes(key)} onChange={() => help.toggle(key)}
          hint={count ? `${hint} · ${t.inText.replace("{count}", String(count))}` : hint} />;
      })}
    </Dialog>
    <Dialog open={view === "firstSentence" && Boolean(notice)} title={t.firstSentence} actions={close} onClose={onClose}>
      {notice && <>
        <div className={styles.assignment}>
          <strong>{notice.course} / {notice.title}</strong>
          <p className={styles.quiet}>{[
            notice.due && t.due.replace("{date}", notice.due),
            notice.length && t.length.replace("{min}", String(notice.length.min)).replace("{max}", String(notice.length.max)),
          ].filter(Boolean).join(" · ")}</p>
        </div>
        {notice.instructions}
      </>}
    </Dialog>
    <Dialog open={view === "recorded"} title={t.recorded} actions={close} onClose={onClose}>
      <dl className={styles.recording}>{t.recording.map(([heading, text]) => (
        <div key={heading}><dt>{heading}</dt><dd>{text}</dd></div>
      ))}</dl>
    </Dialog>
  </>;
}
