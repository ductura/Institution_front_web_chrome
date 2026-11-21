"use client";

import { useEffect, useRef, useState } from "react";
import { Button, DiffView } from "@ductura/ui";

import { diffParts, orderedPair, orderVersions, type CompareRead, type TimeMachinePort, type Version } from "./model";
import { timeMachineMessages as text } from "./messages.hr";

type Versions = { readonly list: readonly Version[]; readonly partial: boolean } | "unavailable" | "signedOut" | null;

/** "Povijest verzija" in the editor (WEB-1504; M7.6): opens on request, two selects, a diff. Keyboard-only usable. */
export default function TimeMachine({ documentId, port }: { documentId: string; port: TimeMachinePort }) {
  const [shown, setShown] = useState(false);
  const [versions, setVersions] = useState<Versions>(null);
  const [attempt, setAttempt] = useState(0);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const request = useRef(0);
  const [result, setResult] = useState<CompareRead | "loading" | "same" | null>(null);

  useEffect(() => {
    if (!shown) return;
    let active = true;
    void port.versions(documentId)
      .then((read) => { if (active) setVersions(read.kind === "ready" ? { list: orderVersions(read.versions), partial: read.partial } : read.kind); })
      .catch(() => { if (active) setVersions("unavailable"); });
    return () => { active = false; };
  }, [shown, documentId, port, attempt]);

  if (!shown) return <Button onClick={() => setShown(true)}>{text.open}</Button>;

  const compare = async () => {
    const pair = orderedPair(Number(a), Number(b));
    if (a === "" || b === "" || pair === null) { setResult(a !== "" && b !== "" ? "same" : null); return; }
    const mine = ++request.current;
    setResult("loading");
    let read: CompareRead;
    try { read = await port.compare(documentId, pair.from, pair.to); } catch { read = { kind: "unavailable" }; }
    if (mine === request.current) setResult(read);
  };

  const list = versions !== null && typeof versions === "object" ? versions.list : null;
  const select = (label: string, value: string, set: (v: string) => void) => (
    <label>
      {label}
      <select value={value} onChange={(e) => { request.current += 1; set(e.target.value); setResult(null); }}>
        <option value="">{text.choose}</option>
        {list?.map((v) => <option key={v.revision} value={String(v.revision)}>{text.version(v.kind, v.revision, v.savedMinute)}</option>)}
      </select>
    </label>
  );

  return (
    <section aria-label={text.title}>
      <h2>{text.title}</h2>
      {versions === null ? <p role="status">{text.loading}</p>
        : versions === "signedOut" ? <p role="alert">{text.signedOut}</p>
        : versions === "unavailable" ? (
          <>
            <p role="alert">{text.unavailable}</p>
            <Button onClick={() => { setVersions(null); setAttempt((n) => n + 1); }}>{text.retry}</Button>
          </>
        ) : list!.length < 2 ? <p>{text.empty}</p> : (
          <>
            <p>{text.intro}</p>
            {typeof versions === "object" && versions.partial ? <p role="status">{text.partialVersions}</p> : null}
            {select(text.from, a, setA)}
            {select(text.to, b, setB)}
            <Button onClick={() => void compare()}>{text.compare}</Button>
            <div aria-live="polite">
              {result === "loading" ? <p role="status">{text.loadingCompare}</p>
                : result === "same" ? <p role="status">{text.samePoint}</p>
                : result === null ? null
                : result.kind === "ready" ? (
                  <>
                    {result.truncated ? <p role="status">{text.truncated}</p> : null}
                    <DiffView parts={diffParts(result.blocks)} />
                  </>
                )
                : <p role="alert">{result.kind === "signedOut" ? text.signedOut : text.compareFailed}</p>}
            </div>
          </>
        )}
      <Button onClick={() => { request.current += 1; setShown(false); setVersions(null); setResult(null); setA(""); setB(""); }}>{text.close}</Button>
    </section>
  );
}
