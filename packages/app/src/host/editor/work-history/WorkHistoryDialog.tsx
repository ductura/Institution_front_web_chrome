"use client";

// ED-16 (NF2-P14): one dialog for the work's history. The list of saved versions ("Verzije rada (n)"),
// the text of one of them only for reading, and one comparison of the sent versions only (decision
// 2160, through the shared VersionComparison). Restoring a version is a separate step (P-15).
import { useEffect, useState } from "react";
import { Button, Dialog, Notice } from "@ductura/ui";

import { VersionComparison } from "../../../../../../src/components/editor/diff/VersionComparison.tsx";
import type { ComparisonApi } from "../../../../../../src/components/editor/diff/comparison-read.ts";
import { versionText, type TimeMachinePort, type VersionText } from "../../student/time-machine/model";
import { workHistoryHr as t } from "./messages.hr";
import { historyRows, type HistoryRow } from "./work-history";
import styles from "./WorkHistory.module.css";

type List = { readonly rows: readonly HistoryRow[]; readonly more: boolean } | "failed" | "signedOut" | null;
type Text = VersionText | "loading" | "failed" | "signedOut";
type Shown = { readonly row: HistoryRow; readonly text: Text };

export type WorkHistoryDialogProps = {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly documentId: string;
  readonly port: TimeMachinePort;
  readonly client: ComparisonApi;
  readonly replayHref: string;
};

export function WorkHistoryDialog({ open, onClose, documentId, port, client, replayHref }: WorkHistoryDialogProps) {
  const [list, setList] = useState<List>(null);
  const [attempt, setAttempt] = useState(0);
  const [shown, setShown] = useState<Shown | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setList(null);
    setShown(null);
    void port.versions(documentId)
      .then((read) => {
        if (!live) return;
        setList(read.kind === "ready" ? { rows: historyRows(read.versions, read.more === true), more: read.more === true }
          : read.kind === "signedOut" ? "signedOut" : "failed");
      })
      .catch(() => { if (live) setList("failed"); });
    return () => { live = false; };
  }, [open, documentId, port, attempt]);

  const show = async (row: HistoryRow) => {
    setShown({ row, text: "loading" });
    let text: Text;
    try {
      const read = await port.version(documentId, row.revision);
      text = read.kind === "ready" ? versionText(read.document) : read.kind === "signedOut" ? "signedOut" : "failed";
    } catch {
      text = "failed";
    }
    setShown((now) => (now?.row.revision === row.revision ? { row, text } : now));
  };

  const close = <Button tone="secondary" onClick={onClose}>{t.close}</Button>;
  const actions = list === "failed" ? <>{close}<Button onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button></>
    : shown !== null ? <>{close}<Button tone="secondary" onClick={() => setShown(null)}>{t.back}</Button></>
    : close;

  return (
    <Dialog open={open} title={shown === null ? t.title : t.readOnly(shown.row.name)} onClose={onClose} actions={actions}>
      <div data-work-history>
        {list === null ? <p role="status">{t.loading}</p>
          : list === "failed" ? <p role="alert">{t.failed}</p>
          : list === "signedOut" ? <p role="alert">{t.signedOut}</p>
          : shown !== null ? <VersionTextView shown={shown} />
          : list.rows.length === 0 ? <p role="status">{t.empty}</p> : (
            <>
              <section className={styles.section} aria-labelledby="work-history-list">
                <h3 id="work-history-list">{t.listTitle(list.rows.length)}</h3>
                {list.more ? <p data-older-versions>{t.more}</p> : null}
                <ul className={styles.list}>
                  {list.rows.map((row) => (
                    <li key={row.revision}>
                      <Button tone="quiet" onClick={() => void show(row)}>
                        <span className={styles.row}><span>{row.name}</span><span>{row.day}</span></span>
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
              <section className={styles.section} aria-labelledby="work-history-compare">
                <h3 id="work-history-compare">{t.compareTitle}</h3>
                <VersionComparison mode="with" client={client} documentId={documentId} replayHref={replayHref} />
              </section>
            </>
          )}
      </div>
    </Dialog>
  );
}

function VersionTextView({ shown }: { shown: Shown }) {
  const { text } = shown;
  if (text === "loading") return <p role="status">{t.loadingText}</p>;
  if (text === "signedOut") return <p role="alert">{t.signedOut}</p>;
  if (text === "failed") return <p role="alert">{t.textFailed}</p>;
  if (text.kind === "unreadable") return <p role="alert">{t.unreadable}</p>;
  return (
    <article aria-label={t.readOnly(shown.row.name)} data-version-text={shown.row.revision}>
      <Notice>{shown.row.day}</Notice>
      {text.blocks.length === 0 ? <p>{t.blank}</p>
        : text.blocks.map((b, i) => {
          // The version's own headings sit below the dialog's title: level 1 to 3 become h3 to h5.
          const Heading = (`h${(b.level ?? 1) + 2}`) as "h3" | "h4" | "h5";
          return b.kind === "heading" ? <Heading key={i}>{b.text}</Heading> : <p key={i}>{b.text}</p>;
        })}
    </article>
  );
}
