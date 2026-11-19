"use client";

import {
  Button, Checkbox, Details, Dialog, Icon, ICON_NAMES, SAVE_STATES, SaveState, Select, Skeleton, Tag, TextArea, ToastRegion,
  DataTable, Fingerprint, KeyValueList, StateTag, Steps, SUBMISSION_STATES, toggleTheme, useToasts,
  type DataTableColumn, type SaveStateName, type SubmissionState,
} from "@ductura/ui";
import { useEffect, useRef, useState } from "react";

import { messagesHr as t } from "../../lib/i18n/messages.hr";
import { zagrebWall } from "../../lib/i18n/zagreb";

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

type SampleRow = { id: SubmissionState; name: string; at: number | null };

const sampleStudents = ["Ana Anić (demo)", "Ivo Čavlek (demo)", "Petra Šimić (demo)", "Luka Zorić (demo)", "Maja Babić (demo)"];
const sampleRows: SampleRow[] = SUBMISSION_STATES.map((state, index) => ({
  id: state,
  name: sampleStudents[index],
  at: state === "not_submitted" || state === "pending" ? null : Date.UTC(2026, 10, 19, 9 + index, 5 * index),
}));

function zagrebMinute(ms: number) {
  const { day, month, year, hour, minute } = zagrebWall(ms);
  return `${day}. ${month}. ${year}. ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

const sampleColumns: DataTableColumn<SampleRow>[] = [
  { id: "student", header: t.uiPreview.student, cell: (row) => row.name, sortValue: (row) => row.name, rowHeader: true },
  { id: "state", header: t.uiPreview.state, cell: (row) => <StateTag state={row.id} /> },
  {
    id: "at", header: t.uiPreview.submittedAt, sortValue: (row) => row.at,
    cell: (row) => row.at === null ? "" : <time dateTime={new Date(row.at).toISOString()}>{zagrebMinute(row.at)}</time>,
  },
];

export default function UiPreview() {
  const [tokens, setTokens] = useState<Token[]>([]);
  // Read after mounting and after every toggle, so the values always match the
  // theme on <html>, a kept light theme included.
  useEffect(() => setTokens(readTokens()), []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const stayRef = useRef<HTMLButtonElement>(null);
  const { toasts, show, dismiss } = useToasts();

  return (
    <main id="sadrzaj" className="page" style={{ display: "grid", gap: 24, padding: 24, maxWidth: 1200 }}>
      <h1>{t.uiPreview.title}</h1>
      <p>{t.uiPreview.intro}</p>
      <p>
        <button type="button" className="btn" onClick={() => {
          toggleTheme(document.documentElement, globalThis.localStorage);
          setTokens(readTokens());
        }}>
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

      <section aria-labelledby="pregled-obrasci" style={{ display: "grid", gap: 16 }}>
        <h2 id="pregled-obrasci">{t.uiPreview.forms}</h2>
        <Checkbox label={t.uiPreview.checkbox} />
        <Select label={t.uiPreview.select} placeholder={t.uiPreview.selectPlaceholder}
          options={[{ value: "a", label: t.uiPreview.groupA }, { value: "b", label: t.uiPreview.groupB }]} />
        <TextArea label={t.uiPreview.textarea} hint={t.uiPreview.textareaHint} />
        <p style={{ display: "flex", gap: 8 }}>
          <Tag>{t.uiPreview.tagGroup}</Tag><Tag tone="accent">{t.uiPreview.tagYear}</Tag><Tag tone="warn">{t.uiPreview.tagExtended}</Tag>
        </p>
        <Skeleton label={t.uiPreview.loading} />
        <Details summary={t.uiPreview.detailsSummary}><p>{t.uiPreview.detailsBody}</p></Details>
      </section>

      <section aria-labelledby="pregled-predaja" style={{ display: "grid", gap: 16 }}>
        <h2 id="pregled-predaja">{t.submission.title}</h2>
        <Steps currentStep={5} />
        <KeyValueList items={[
          {
            id: "requested-at",
            label: t.submission.requestedAt,
            value: <time dateTime="2026-11-19T10:00:00Z">19. 11. 2026. 11:00</time>,
            details: { summary: "UTC", children: "2026-11-19T10:00:00Z" },
          },
          {
            id: "text-hash",
            label: t.submission.textHash,
            value: <Fingerprint value={"0123456789abcdef".repeat(4)} />,
          },
        ]} />
      </section>

      <section aria-labelledby="pregled-tablica" style={{ display: "grid", gap: 16, minWidth: 0 }}>
        <h2 id="pregled-tablica">{t.uiPreview.table}</h2>
        <DataTable caption={t.uiPreview.tableCaption} columns={sampleColumns} rows={sampleRows} rowKey={(row) => row.id} empty={t.uiPreview.tableEmpty} />
        <DataTable caption={t.uiPreview.tableEmptyCaption} columns={sampleColumns} rows={[]} rowKey={(row) => row.id} empty={t.uiPreview.tableEmpty} />
        <DataTable caption={t.uiPreview.tableLoadingCaption} columns={sampleColumns} rows={[]} rowKey={(row) => row.id} empty={t.uiPreview.tableEmpty} loading />
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
