"use client";

import { useEffect, useState } from "react";
import { Button, TextField } from "@ductura/ui";

import { TOOLS_MAX, type DeclaredTool, type StatementPort, type StatementRead } from "../../../../../../src/client/statement.ts";
import { isReadOnly, saveTools, toolsAfterRead, toolsError, writeNotice } from "./model";
import { statementMessages as text } from "./messages.hr";

const EMPTY: DeclaredTool = { tool: "", purpose: "", phase: "" };

/**
 * ED-12 (NF2-P12, prototype nf2decl): "Vanjski alati", the tools outside Ductura the student declares,
 * each with what it was for and in which phase of the work (ai.declaredTools of declaration-v1). The
 * whole list is one write on the same draft as the rest of the statement; after submission it is read
 * only. Shown only where the port keeps tools.
 */
export default function DeclaredTools({ port, assignmentId, read, onReload, onSignIn }: {
  port: StatementPort;
  assignmentId: string;
  read: StatementRead & { kind: "ready" };
  onReload: () => void;
  onSignIn: () => void;
}) {
  const [rows, setRows] = useState<readonly DeclaredTool[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "status" | "alert"; message: string } | null>(null);
  useEffect(() => { setRows((current) => toolsAfterRead(current, read)); }, [read]);

  const locked = isReadOnly(read);
  const list = rows ?? read.tools ?? [];
  const change = (index: number, part: keyof DeclaredTool, value: string) =>
    setRows(list.map((row, i) => (i === index ? { ...row, [part]: value } : row)));

  const save = async () => {
    const result = await saveTools(port, assignmentId, read, list);
    if (result.kind === "invalid") { setError(toolsError(result.check)); setNotice(null); return; }
    setError(null);
    if (result.kind === "signedOut") return onSignIn();
    setNotice(result.kind === "saved" ? { tone: "status", message: text.tools.saved } : writeNotice(result));
    if (result.kind === "saved") setRows(null);
    if (result.kind === "saved" || result.kind === "conflict") onReload();
  };

  return (
    <fieldset aria-describedby="declared-tools-note" data-declared-tools={list.length}>
      <legend>{text.tools.title}</legend>
      <p id="declared-tools-note">{text.tools.note}</p>
      {list.length === 0 && <p>{text.tools.none}</p>}
      <ol>
        {list.map((row, index) => {
          const n = String(index + 1);
          return (
            <li key={index} aria-label={text.tools.row.replace("{n}", n)}>
              <TextField label={text.tools.tool} value={row.tool} readOnly={locked} onChange={(e) => change(index, "tool", e.target.value)} />
              <TextField label={text.tools.purpose} value={row.purpose} readOnly={locked} onChange={(e) => change(index, "purpose", e.target.value)} />
              <TextField label={text.tools.phase} value={row.phase} readOnly={locked} onChange={(e) => change(index, "phase", e.target.value)} />
              {!locked && (
                <Button tone="quiet" onClick={() => setRows(list.filter((_, i) => i !== index))}>{text.tools.remove.replace("{n}", n)}</Button>
              )}
            </li>
          );
        })}
      </ol>
      {!locked && <>
        <Button tone="secondary" disabled={list.length >= TOOLS_MAX} onClick={() => setRows([...list, EMPTY])}>{text.tools.add}</Button>
        {/* Always pressable: a list the server would not take says why instead of a silent grey button. */}
        <Button onClick={() => void save()}>{text.tools.save}</Button>
      </>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role={notice.tone === "alert" ? "alert" : "status"}>{notice.message}</p>}
    </fieldset>
  );
}
