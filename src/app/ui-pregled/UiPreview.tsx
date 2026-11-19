"use client";

import {
  Button, Dialog, Icon, ICON_NAMES, SAVE_STATES, SaveState, ToastRegion, toggleTheme, useToasts, type SaveStateName,
} from "@ductura/ui";
import { useEffect, useRef, useState } from "react";

import { messagesHr as t } from "../../lib/i18n/messages.hr";

type Token = { name: string; value: string };

/** Every custom property the loaded style sheets set on :root, with its value in the current theme. */
function readTokens(): Token[] {
  const names = new Set<string>();
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSStyleRule) || !rule.selectorText.startsWith(":root")) continue;
      for (const name of Array.from(rule.style)) if (name.startsWith("--")) names.add(name);
    }
  }
  const style = getComputedStyle(document.documentElement);
  return [...names].sort().map((name) => ({ name, value: style.getPropertyValue(name).trim() }));
}

const sample = (
  <p>
    {t.uiPreview.sheetSample} <a href="#sadrzaj">{t.uiPreview.sheetLink}</a>
  </p>
);

export default function UiPreview() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [theme, setTheme] = useState("dark");
  useEffect(() => setTokens(readTokens()), [theme]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const stayRef = useRef<HTMLButtonElement>(null);
  const { toasts, show, dismiss } = useToasts();

  return (
    <main id="sadrzaj" className="page" style={{ display: "grid", gap: 24, padding: 24, maxWidth: 1200 }}>
      <h1>{t.uiPreview.title}</h1>
      <p>{t.uiPreview.intro}</p>
      <p>
        <button type="button" className="btn" onClick={() => setTheme(toggleTheme(document.documentElement, globalThis.localStorage))}>
          {t.uiPreview.theme}
        </button>
      </p>

      <section aria-labelledby="pregled-stanja">
        <h2 id="pregled-stanja">{t.uiPreview.saveStates}</h2>
        <ul style={{ display: "flex", flexWrap: "wrap", gap: 12, listStyle: "none", padding: 0 }}>
          {(Object.keys(SAVE_STATES) as SaveStateName[]).map((state) => (
            <li key={state}>
              <SaveState state={state} />
            </li>
          ))}
          <li>
            <SaveState state="EDITING" blocked />
          </li>
        </ul>
      </section>

      <section aria-labelledby="pregled-dijalog">
        <h2 id="pregled-dijalog">{t.uiPreview.dialogs}</h2>
        <p style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Button tone="quiet" onClick={() => setDialogOpen(true)}>{t.uiPreview.openDialog}</Button>
          <Button tone="quiet" onClick={() => show(t.uiPreview.toastText)}>{t.uiPreview.showToast}</Button>
          <Button tone="quiet" onClick={() => show(t.uiPreview.errorToastText, "error")}>{t.uiPreview.showErrorToast}</Button>
        </p>
        <Dialog open={dialogOpen} title={t.uiPreview.dialogTitle} onClose={() => setDialogOpen(false)} initialFocus={stayRef}
          actions={<>
            <Button ref={stayRef} tone="quiet" onClick={() => setDialogOpen(false)}>{t.uiPreview.dialogStay}</Button>
            <Button onClick={() => setDialogOpen(false)}>{t.uiPreview.dialogClose}</Button>
          </>}>
          <p>{t.uiPreview.dialogText}</p>
        </Dialog>
        <ToastRegion toasts={toasts} onDismiss={dismiss} label={t.uiPreview.toasts} closeLabel={t.uiPreview.dialogClose} />
      </section>

      <section aria-labelledby="pregled-ikone">
        <h2 id="pregled-ikone">{t.uiPreview.icons}</h2>
        <ul style={{ display: "flex", flexWrap: "wrap", gap: 16, listStyle: "none", padding: 0 }}>
          {ICON_NAMES.map((name) => (
            <li key={name} style={{ display: "grid", justifyItems: "center", gap: 4 }}>
              <Icon name={name} size={20} />
              <code>{name}</code>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="pregled-list">
        <h2 id="pregled-list">{t.uiPreview.sheets}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          <div className="sheet" data-sheet-theme="dark" style={{ background: "var(--sheet)", color: "var(--ink)", padding: 16 }}>
            <h3>{t.uiPreview.darkSheet}</h3>
            {sample}
          </div>
          <div className="sheet" data-sheet-theme="light" style={{ background: "var(--sheet)", color: "var(--ink)", padding: 16 }}>
            <h3>{t.uiPreview.whiteSheet}</h3>
            {sample}
          </div>
        </div>
      </section>

      <section aria-labelledby="pregled-tokeni">
        <h2 id="pregled-tokeni">{t.uiPreview.tokens}</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">{t.uiPreview.token}</th>
              <th scope="col">{t.uiPreview.value}</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((token) => (
              <tr key={token.name}>
                <td>
                  <span aria-hidden="true" style={{ display: "inline-block", width: 16, height: 16, marginInlineEnd: 8, verticalAlign: "middle", background: `var(${token.name})`, border: "1px solid var(--rule)" }} />
                  <code>{token.name}</code>
                </td>
                <td>
                  <code>{token.value}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
