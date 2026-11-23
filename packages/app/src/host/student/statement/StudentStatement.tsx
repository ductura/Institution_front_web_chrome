"use client";

import { useEffect, useState } from "react";
import { Button, Select, TextArea } from "@ductura/ui";

import type { HumanHelp, HumanHelpKind, StatementPort, StatementRead } from "../../../../../../src/client/statement.ts";
import { attachFile, helpAfterRead, helpValid, isReadOnly, saveHelp, withKind, writeNotice } from "./model";
import { statementMessages as text } from "./messages.hr";

/**
 * Human-help statement and printout of an external conversation (WEB-1503), mounted in the
 * declaration step (PIL-K-IZJAVA). The step reads both halves together and hands this one its
 * read, so both write on one version; every write ends with `onReload`, which reads both again.
 * The statement text and the allowed formats come from the server; after submission every
 * control is read only. A failed write stays as an alert and keeps what the student typed.
 */
export default function StudentStatement({ port, assignmentId, read, onReload, onSignIn }: {
  port: StatementPort;
  assignmentId: string;
  /** The step's read of this half; null while it loads. */
  read: StatementRead | null;
  onReload: () => void;
  onSignIn: () => void;
}) {
  const [draft, setDraft] = useState<HumanHelp | null>(null);
  const [fileError, setFileError] = useState<string | undefined>();
  const [notice, setNotice] = useState<{ tone: "status" | "alert"; message: string } | null>(null);

  useEffect(() => {
    if (read !== null) setDraft((current) => helpAfterRead(current, read));
  }, [read]);

  if (read === null) return <p role="status">{text.loading}</p>;
  if (read.kind !== "ready") {
    return (
      <div>
        <p role="alert">{text.unavailable}</p>
        <Button tone="quiet" onClick={onReload}>{text.retry}</Button>
      </div>
    );
  }

  const locked = isReadOnly(read);
  const help = draft ?? { kind: read.helpKinds[0] ?? "none", text: "" };
  const { kind, text: helpText } = help;

  const save = async () => {
    const result = await saveHelp(port, assignmentId, read, help);
    if (result.kind === "signedOut") return onSignIn();
    setNotice(writeNotice(result));
    // Saved or overtaken: both halves show what the server now holds.
    if (result.kind === "saved" || result.kind === "conflict") onReload();
  };

  const attach = async (file: File | undefined) => {
    if (!file) return;
    const result = await attachFile(port, assignmentId, read, file);
    if (result.kind === "invalid") { setFileError(result.message); return; }
    setFileError(undefined);
    if (result.kind === "signedOut") return onSignIn();
    if (result.kind !== "saved") setNotice(writeNotice(result));
    if (result.kind === "saved" || result.kind === "conflict") onReload();
  };

  return (
    <section aria-labelledby="statement-h" data-statement-readonly={locked || undefined}>
      <h2 id="statement-h">{text.title}</h2>
      <p>{read.statementText}</p>
      <Select label={text.helpLegend} disabled={locked} value={kind}
        options={read.helpKinds.map((k) => ({ value: k, label: text.helpKinds[k] }))}
        onChange={(event) => setDraft(withKind(help, event.target.value as HumanHelpKind))} />
      {kind !== "none" && (
        <TextArea label={text.helpText} readOnly={locked} value={helpText} onChange={(event) => setDraft({ kind, text: event.target.value })} />
      )}
      <h3>{text.printoutTitle}</h3>
      <p>{text.printoutNote}</p>
      {read.attachment && <p>{text.attached}: {read.attachment.name}</p>}
      {!locked && (
        <label>
          {text.printoutLabel}
          <input type="file" accept={read.limits.allowedFormats.map((f) => f.extension).join(",")}
            aria-invalid={fileError ? true : undefined}
            onChange={(event) => { void attach(event.target.files?.[0]); event.target.value = ""; }} />
        </label>
      )}
      {fileError && <p role="alert">{fileError}</p>}
      {locked
        ? <p role="status">{text.readOnly}</p>
        : <Button disabled={!helpValid(help)} onClick={() => void save()}>{text.save}</Button>}
      {notice && <p role={notice.tone === "alert" ? "alert" : "status"}>{notice.message}</p>}
    </section>
  );
}
