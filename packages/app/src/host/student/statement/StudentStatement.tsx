"use client";

import { useEffect, useState } from "react";
import { Button, Select, TextArea } from "@ductura/ui";

import type { HumanHelpKind, StatementPort, StatementRead } from "../../../../../../src/client/statement.ts";
import { attachFile, helpValid, isReadOnly, saveHelp } from "./model";
import { statementMessages as text } from "./messages.hr";

/**
 * Human-help statement and printout of an external conversation (WEB-1503). The statement text and
 * the allowed formats come from the server; after submission every control is read only.
 */
export default function StudentStatement({ port, assignmentId }: { port: StatementPort; assignmentId: string }) {
  const [read, setRead] = useState<StatementRead | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [kind, setKind] = useState<HumanHelpKind>("none");
  const [helpText, setHelpText] = useState("");
  const [fileError, setFileError] = useState<string | undefined>();
  const [notice, setNotice] = useState<{ tone: "status" | "alert"; message: string } | null>(null);

  useEffect(() => {
    let active = true;
    void port.read(assignmentId).then((next) => {
      if (!active) return;
      setRead(next);
      if (next.kind === "ready" && next.humanHelp) {
        setKind(next.humanHelp.kind);
        setHelpText(next.humanHelp.text);
      }
    }).catch(() => { if (active) setRead({ kind: "unavailable" }); });
    return () => { active = false; };
  }, [port, assignmentId, attempt]);

  if (read === null) return <p role="status">{text.loading}</p>;
  if (read.kind !== "ready") {
    return (
      <div>
        <p role="alert">{text.unavailable}</p>
        <Button tone="quiet" onClick={() => { setRead(null); setAttempt((n) => n + 1); }}>{text.retry}</Button>
      </div>
    );
  }

  const locked = isReadOnly(read);
  const help = { kind, text: helpText };

  const save = async () => {
    const result = await saveHelp(port, assignmentId, read, help);
    setNotice(result.kind === "saved"
      ? { tone: "status", message: text.saved }
      : { tone: "alert", message: result.kind === "rejected" ? text.rejected : text.failed });
  };

  const attach = async (file: File | undefined) => {
    if (!file) return;
    const result = await attachFile(port, assignmentId, read, file);
    if (result.kind === "invalid") { setFileError(result.message); return; }
    setFileError(undefined);
    if (result.kind === "saved") setAttempt((n) => n + 1);
    else setNotice({ tone: "alert", message: text.failed });
  };

  return (
    <section aria-labelledby="statement-h" data-statement-readonly={locked || undefined}>
      <h2 id="statement-h">{text.title}</h2>
      <p>{read.statementText}</p>
      <Select label={text.helpLegend} disabled={locked} value={kind}
        options={read.helpKinds.map((k) => ({ value: k, label: text.helpKinds[k] }))}
        onChange={(event) => setKind(event.target.value as HumanHelpKind)} />
      {kind !== "none" && (
        <TextArea label={text.helpText} readOnly={locked} value={helpText} onChange={(event) => setHelpText(event.target.value)} />
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
