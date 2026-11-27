"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { LiveDocument } from "@/client/live-publisher";
import { checkFingerprint, fingerprintLabel, type FingerprintState, type RecordedFingerprint } from "./fingerprint-check";
import styles from "./fingerprint.module.css";

const wait = (ms: number) => new Promise<void>((done) => { setTimeout(done, ms); });

/**
 * Otisak verzije u gornjoj traci nastavnika (ODLUKE naslovnice, 25. 11. 2026.): samo riječi u boji stanja, bez
 * ispisanog SHA, kapsule i točke. Dok se računa, sivo „Provjeravam otisak…” s malim kružićem; klik provjerava
 * ponovno. Provjera traje barem `minMs`, da se ponovna provjera vidi i kad je izračun trenutačan.
 */
export default function Fingerprint({ document, recorded, check = checkFingerprint, minMs = 500 }: {
  document: LiveDocument; recorded: RecordedFingerprint;
  check?: (document: LiveDocument, recorded: RecordedFingerprint) => Promise<FingerprintState>; minMs?: number;
}) {
  const [state, setState] = useState<FingerprintState>({ kind: "checking" });
  const latest = useRef(0);
  const { sha256, revision } = recorded;
  const run = useCallback(() => {
    const id = ++latest.current;
    setState({ kind: "checking" });
    void Promise.all([check(document, { sha256, revision }).catch((): FingerprintState => ({ kind: "unavailable" })), wait(minMs)])
      .then(([next]) => { if (id === latest.current) setState(next); });
  }, [check, document, sha256, revision, minMs]);
  useEffect(() => {
    run();
    // Odgovor provjere koja je zastarjela ili stiže nakon odlaska sa stranice ne mijenja oznaku.
    return () => { latest.current += 1; };
  }, [run]);

  const { label, small, title } = fingerprintLabel(state);
  return (
    <button type="button" className={styles.mark} data-s={state.kind} title={title} aria-live="polite"
      aria-busy={state.kind === "checking" || undefined} onClick={run}>
      {state.kind === "checking" && <i aria-hidden="true" />}
      <b>{label}</b>
      {small !== null && <small>{small}</small>}
    </button>
  );
}
