import { Button } from "../Button";
import styles from "./PortableRecordCard.module.css";

/** What the card shows: ready to download, being downloaded, or why it failed (the message is the app's own). */
export type PortableRecordState =
  | { readonly kind: "ready" }
  | { readonly kind: "downloading" }
  | { readonly kind: "error"; readonly message: string };

export type PortableRecordLabels = {
  title: string;
  /** What the record holds, in plain words; no numbers and no grades. */
  contents: readonly string[];
  contentsLead: string;
  download: string;
  downloading: string;
  /** How to check the record, in plain words: on this computer, or by the QR code on the public page. */
  howTo: readonly string[];
  howToLead: string;
};

export type PortableRecordCardProps = {
  state: PortableRecordState;
  labels: PortableRecordLabels;
  onDownload: () => void;
};

/**
 * "Prenosivi zapis" on the student's confirmation of submission (WEB-1304; M7.10). Pure markup with
 * the app's texts: no request. It shows what the record holds and how to check it, never a number
 * or a grade; the file itself comes from the page that owns the download.
 */
export function PortableRecordCard({ state, labels, onDownload }: PortableRecordCardProps) {
  const busy = state.kind === "downloading";
  return (
    <section className={styles.card} aria-labelledby="portable-record-title" data-state={state.kind}>
      <h3 id="portable-record-title" className={styles.title}>{labels.title}</h3>
      <p className={styles.lead}>{labels.contentsLead}</p>
      <ul className={styles.list}>{labels.contents.map((line) => <li key={line}>{line}</li>)}</ul>
      <p className={styles.lead}>{labels.howToLead}</p>
      <ul className={styles.list}>{labels.howTo.map((line) => <li key={line}>{line}</li>)}</ul>
      {state.kind === "error" ? <p role="alert" className={styles.error}>{state.message}</p> : null}
      <p className={styles.actions}>
        <Button busy={busy} onClick={onDownload}>{busy ? labels.downloading : labels.download}</Button>
      </p>
      <span className={styles.status} role="status">{busy ? labels.downloading : ""}</span>
    </section>
  );
}
