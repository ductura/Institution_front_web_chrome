import { createElement as h, useId } from "react";

import { INTERFACE_LOCALES, type InterfaceLocale } from "../i18n/locale.ts";
import { LANGUAGE_NAMES, SETTINGS_EN, SETTINGS_HR } from "../i18n/settings.ts";

import type { PersonalSetting, SettingsRead, SettingValue } from "./settings-model";
import styles from "./Settings.module.css";

export type SettingsNotice = "changed" | "rejected" | "failed" | null;

export type SettingsProps = {
  /** readSettings(createApi()), made by the page. */
  read: SettingsRead;
  /** The language the screen is drawn in; the saved one (read.locale), else the default. */
  locale?: InterfaceLocale;
  /** The answer to the last change; drawn in a live status. */
  notice?: SettingsNotice;
  /** True while a change is on its way: every control waits. */
  busy?: boolean;
  /** The page passes these on to saveSetting and saveInterfaceLocale. */
  onSetting?: (key: string, value: SettingValue) => void;
  onLocale?: (locale: InterfaceLocale) => void;
};

/**
 * DAN-872: the caller's own settings. The interface language (F-06, the
 * screen only, never the language of a work) and the personal keys of the
 * catalogue that have a label; the screen offers only what the catalogue
 * allows (an integer within min and max, an enum's values). Written with
 * `createElement`, like TeacherCourses, so unit tests need no JSX compiler.
 */
export default function Settings({ read, locale: drawn, notice = null, busy = false, onSetting, onLocale }: SettingsProps) {
  const locale = drawn ?? (read.kind === "ready" ? read.locale : null) ?? "hr";
  const t = locale === "en" ? SETTINGS_EN : SETTINGS_HR;
  const id = useId();
  const head = [h("h1", { key: "h" }, t.heading), h("p", { key: "l", className: styles.lede }, t.lede)];
  if (read.kind !== "ready") {
    return h("div", { className: styles.root }, ...head,
      read.kind === "signedOut" ? h("p", { role: "status" }, t.signedOut) : h("p", { role: "alert", className: styles.alert }, t.unavailable));
  }
  const labels: Record<string, string> = t.keys;
  const shown = read.settings.filter((s) => Object.hasOwn(labels, s.key));
  const control = (s: PersonalSetting) => {
    const props = { id: `${id}-${s.key}`, disabled: busy, className: styles.control };
    if (s.kind === "boolean") {
      return h("input", { ...props, type: "checkbox", checked: s.value === true, onChange: (e: { target: { checked: boolean } }) => onSetting?.(s.key, e.target.checked) });
    }
    if (s.kind === "enum") {
      return h("select", { ...props, value: String(s.value), onChange: (e: { target: { value: string } }) => onSetting?.(s.key, e.target.value) },
        (s.values ?? []).map((v) => h("option", { key: v, value: v }, v)));
    }
    return h("input", {
      ...props, type: "number", inputMode: "numeric", min: s.min, max: s.max, step: 1, value: String(s.value),
      onChange: (e: { target: { value: string } }) => onSetting?.(s.key, Number(e.target.value)),
    });
  };
  return h("div", { className: styles.root }, ...head,
    h("fieldset", { className: styles.group, disabled: busy },
      h("legend", null, t.language.legend),
      h("p", { id: `${id}-note`, className: styles.note }, t.language.note),
      INTERFACE_LOCALES.map((code) => h("label", { key: code, className: styles.choice, lang: code },
        h("input", {
          type: "radio", name: `${id}-locale`, value: code, checked: (read.locale ?? "hr") === code, "aria-describedby": `${id}-note`,
          onChange: () => onLocale?.(code),
        }),
        LANGUAGE_NAMES[code]))),
    h("div", { className: styles.group },
      h("h2", null, t.personal),
      shown.length === 0 ? h("p", null, t.none) : h("ul", { className: styles.list },
        shown.map((s) => h("li", { key: s.key, className: styles.row },
          h("label", { htmlFor: `${id}-${s.key}` }, labels[s.key]), control(s))))),
    h("p", { role: "status", className: styles.notice }, notice === null ? "" : t.notice[notice]));
}
