import { createElement as h, useId, useState } from "react";

import { INTERFACE_LOCALES, type InterfaceLocale } from "../i18n/locale.ts";
import { LANGUAGE_NAMES, SETTINGS_EN, SETTINGS_HR } from "../i18n/settings.ts";

import {
  applyLocale, applySetting, type PersonalSetting, type ReadySettings, type SettingsCall, type SettingsNotice, type SettingsRead,
} from "./settings-model";
import styles from "./Settings.module.css";

export type { SettingsNotice };

export type SettingsProps = {
  /** readAccountSettings(createApi()), made by the page. */
  read: SettingsRead;
  /** createApi(): every change goes through applySetting or applyLocale. */
  call: SettingsCall;
  /** The language before anything is saved (the page's default); a saved one wins. */
  locale?: InterfaceLocale;
  /** The first answer shown, and whether a change is on its way (the catalogue's states). */
  notice?: SettingsNotice;
  busy?: boolean;
};

/**
 * DAN-872: the caller's own settings. The interface language (F-06, the
 * screen only, never the language of a work) and the personal keys of the
 * catalogue that have a label; the screen offers only what the catalogue
 * allows (an integer within min and max, an enum's values). Each change is
 * saved through `call`; only keys of the catalogue leave the browser. The
 * language in effect (saved, else `locale`, else hr) draws the text, marks
 * the radio and is the `lang` of the screen. Written with `createElement`,
 * like TeacherCourses, so unit tests need no JSX compiler.
 */
export default function Settings({ read: first, call, locale: fallback, notice: firstNotice = null, busy: firstBusy = false }: SettingsProps) {
  const [read, setRead] = useState(first);
  const [notice, setNotice] = useState<SettingsNotice>(firstNotice);
  const [busy, setBusy] = useState(firstBusy);
  const id = useId();
  const locale: InterfaceLocale = (read.kind === "ready" ? read.locale : null) ?? fallback ?? "hr";
  const t = locale === "en" ? SETTINGS_EN : SETTINGS_HR;
  const head = [h("h1", { key: "h" }, t.heading), h("p", { key: "l", className: styles.lede }, t.lede)];
  if (read.kind !== "ready") {
    return h("div", { className: styles.root, lang: locale }, ...head,
      read.kind === "signedOut" ? h("p", { role: "status" }, t.signedOut) : h("p", { role: "alert", className: styles.alert }, t.unavailable));
  }
  const change = (apply: (now: ReadySettings) => Promise<{ read: ReadySettings; notice: SettingsNotice }>) => {
    if (busy) return;
    setBusy(true);
    void apply(read).then((next) => { setRead(next.read); setNotice(next.notice); }, () => setNotice("failed")).finally(() => setBusy(false));
  };
  const labels: Record<string, string> = t.keys;
  const shown = read.settings.filter((s) => Object.hasOwn(labels, s.key));
  const control = (s: PersonalSetting) => {
    const props = { id: `${id}-${s.key}`, disabled: busy, className: styles.control };
    const save = (value: unknown) => change((now) => applySetting(call, now, s.key, value));
    if (s.kind === "boolean") {
      return h("input", { ...props, type: "checkbox", checked: s.value === true, onChange: (e: { target: { checked: boolean } }) => save(e.target.checked) });
    }
    if (s.kind === "enum") {
      return h("select", { ...props, value: String(s.value), onChange: (e: { target: { value: string } }) => save(e.target.value) },
        (s.values ?? []).map((v) => h("option", { key: v, value: v }, v)));
    }
    return h("input", {
      ...props, type: "number", inputMode: "numeric", min: s.min, max: s.max, step: 1, value: String(s.value),
      onChange: (e: { target: { value: string } }) => save(e.target.value === "" ? null : Number(e.target.value)),
    });
  };
  return h("div", { className: styles.root, lang: locale }, ...head,
    h("fieldset", { className: styles.group, disabled: busy },
      h("legend", null, t.language.legend),
      h("p", { id: `${id}-note`, className: styles.note }, t.language.note),
      INTERFACE_LOCALES.map((code) => h("label", { key: code, className: styles.choice, lang: code },
        h("input", {
          type: "radio", name: `${id}-locale`, value: code, checked: locale === code, "aria-describedby": `${id}-note`,
          onChange: () => change((now) => applyLocale(call, INTERFACE_LOCALES, now, code)),
        }),
        LANGUAGE_NAMES[code]))),
    h("div", { className: styles.group },
      h("h2", null, t.personal),
      shown.length === 0 ? h("p", null, t.none) : h("ul", { className: styles.list },
        shown.map((s) => h("li", { key: s.key, className: styles.row },
          h("label", { htmlFor: `${id}-${s.key}` }, labels[s.key]), control(s))))),
    h("p", { role: "status", className: styles.notice }, notice === null ? "" : t.notice[notice]));
}
