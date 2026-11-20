"use client";

/**
 * "Potvrde iz izvora" in the "Izvori" group of the right panel (WEB-1106; Val
 * 11, E§3.4 proofs). For every source of the work: its proofs as thumbnails
 * with their page, and, while the student may write, "Slikaj" (camera),
 * "Slika" (a file or Ctrl+V) and "PDF". The picture or PDF is read in the
 * browser; only the cut-out goes to the server (`ProofDialog`, `saveCapture`).
 * The proofs come back from the server on every opening, each with its page,
 * so a proof stands beside the same page after the work is opened again.
 */

import { Button, Dialog } from "@ductura/ui";
import { useCallback, useEffect, useId, useRef, useState, type ClipboardEvent } from "react";

import type { SourceProof } from "../../../../client/source-proofs";
import { zagrebParts } from "../../../summary/zagreb-time";

import { pictureFromFile, type ProofPicture } from "./crop";
import { proofsHr as t } from "./messages.hr";
import type { PdfPages } from "./pdf-pages";
import { captureReducer, quoteNotice, saveCapture, startCapture, type Capture, type CaptureAction } from "./proof-draft";
import { ProofDialog } from "./ProofDialog";
import { citedWithProof, type CitationPlace, type ProofSource } from "./proof-sources";
import type { ProofsDeps } from "./proofs-deps";
import styles from "./Proofs.module.css";
import { quoteRect, searchQuote } from "./quote-match";

export type SourceProofsPanelProps = {
  sources: readonly ProofSource[];
  citations: readonly CitationPlace[];
  /** The student may attach (not submitted, not the teacher's view). */
  editable: boolean;
  deps: ProofsDeps;
};

type Load =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "expired" }
  | { kind: "ready"; proofs: readonly SourceProof[] };

type Choice = { sourceId: string; label: string; kind: "camera" | "image" | "pdf" };

export function SourceProofsPanel({ sources, citations, editable, deps }: SourceProofsPanelProps) {
  const headingId = useId();
  const [loads, setLoads] = useState<Readonly<Record<string, Load>>>({});
  const [capture, setCapture] = useState<Capture | null>(null);
  const [view, setView] = useState<{ proof: SourceProof; picture: ProofPicture | null; label: string } | null>(null);
  const [said, setSaid] = useState("");
  const [panelError, setPanelError] = useState("");
  const captureRef = useRef<Capture | null>(null);
  const pdfRef = useRef<PdfPages | null>(null);
  const pickRef = useRef<Choice | null>(null);
  const inputs = { camera: useRef<HTMLInputElement>(null), image: useRef<HTMLInputElement>(null), pdf: useRef<HTMLInputElement>(null) };
  captureRef.current = capture;

  const dispatch = useCallback((action: CaptureAction) => setCapture((s) => (s === null ? s : captureReducer(s, action))), []);

  const load = useCallback((sourceId: string) => {
    setLoads((all) => ({ ...all, [sourceId]: { kind: "loading" } }));
    void deps.list(sourceId).then((read) => {
      const next: Load = read.kind === "ok" ? { kind: "ready", proofs: read.proofs }
        : read.kind === "session-expired" ? { kind: "expired" } : { kind: "unavailable" };
      setLoads((all) => ({ ...all, [sourceId]: next }));
    }, () => setLoads((all) => ({ ...all, [sourceId]: { kind: "unavailable" } })));
  }, [deps]);

  const ids = sources.map((s) => s.id).join(",");
  useEffect(() => {
    for (const id of ids === "" ? [] : ids.split(",")) if (loads[id] === undefined) load(id);
  }, [ids, load, loads]);

  // Every cancel, save or new opening starts a new generation: a PDF or picture
  // that finishes opening for an older one is closed and never reaches the dialog.
  const genRef = useRef(0);
  const closePdf = () => {
    genRef.current += 1;
    const pdf = pdfRef.current;
    pdfRef.current = null;
    void pdf?.close().catch(() => undefined);
  };
  useEffect(() => closePdf, []);

  const showPdfPage = useCallback(async (n: number) => {
    const pdf = pdfRef.current;
    if (pdf === null) return;
    const page = Math.min(pdf.count, Math.max(1, n));
    dispatch({ type: "pdfLoading", page, count: pdf.count });
    try {
      const shown = await pdf.page(page);
      // A later page asked for meanwhile wins.
      if (pdfRef.current !== pdf || captureRef.current?.pdf?.page !== page) return;
      const quote = captureRef.current?.quote ?? "";
      const selection = quote.trim() === "" ? null : quoteRect(shown.runs, quote, shown.picture);
      dispatch({ type: "picture", picture: shown.picture, runs: shown.runs, pdf: { page, count: pdf.count, loading: false }, selection });
      const judged = quoteNotice({ quote, runs: shown.runs, pdf: { page, count: pdf.count, loading: false } });
      const scan = shown.runs.map((r) => r.str).join("").trim().length < 20;
      dispatch({ type: "notice", notice: scan ? { kind: "scan" } : judged });
    } catch {
      if (pdfRef.current === pdf) dispatch({ type: "notice", notice: { kind: "pdfFailed" } });
    }
  }, [dispatch]);

  const openFile = async (pick: Choice, file: File) => {
    setPanelError("");
    closePdf();
    const gen = genRef.current;
    if (pick.kind === "pdf") {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) { setPanelError(t.pdfFailed); return; }
      setCapture({ ...startCapture(pick.sourceId, pick.label), notice: { kind: "pdfOpening" } });
      try {
        const pdf = await deps.openPdf(await file.arrayBuffer());
        if (genRef.current !== gen) { void pdf.close().catch(() => undefined); return; }
        pdfRef.current = pdf;
        await showPdfPage(1);
      } catch {
        if (genRef.current === gen) dispatch({ type: "notice", notice: { kind: "pdfFailed" } });
      }
      return;
    }
    const picture = await pictureFromFile(file);
    if (genRef.current !== gen) return;
    if (picture === null) { setPanelError(t.readFailed); return; }
    const open = captureRef.current;
    if (open !== null && open.sourceId === pick.sourceId) dispatch({ type: "picture", picture });
    else setCapture({ ...startCapture(pick.sourceId, pick.label), picture });
  };

  const choose = (pick: Choice) => {
    pickRef.current = pick;
    inputs[pick.kind].current?.click();
  };
  const picked = (file: File | undefined) => {
    const pick = pickRef.current;
    if (file && pick) void openFile(pick, file);
  };
  const pastedImage = (event: ClipboardEvent | globalThis.ClipboardEvent) =>
    [...(event.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));

  // Ctrl+V of a picture while the dialog is open replaces its picture.
  useEffect(() => {
    if (capture === null) return;
    const onPaste = (event: globalThis.ClipboardEvent) => {
      const file = pastedImage(event);
      const open = captureRef.current;
      if (!file || open === null || open.status === "sending") return;
      event.preventDefault();
      closePdf();
      void openFile({ sourceId: open.sourceId, label: open.sourceLabel, kind: "image" }, file);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  });

  const save = async () => {
    const draft = captureRef.current;
    // While a PDF page is loading the shown picture is still the previous page's.
    if (draft === null || draft.status === "sending" || draft.pdf?.loading) return;
    dispatch({ type: "tried" });
    dispatch({ type: "status", status: "sending" });
    const result = await saveCapture(draft, { assignmentId: deps.assignmentId, upload: (_a, sourceId, d) => deps.upload(sourceId, d) });
    if (result.status === "saved") {
      closePdf();
      setCapture(null);
      setLoads((all) => {
        const before = all[draft.sourceId];
        const proofs = before?.kind === "ready" ? before.proofs : [];
        return { ...all, [draft.sourceId]: { kind: "ready", proofs: [...proofs, result.proof] } };
      });
      setSaid(t.saved);
      return;
    }
    // Every other outcome keeps the draft as it is.
    dispatch({ type: "status", status: result.status === "invalid" ? "idle" : result.status });
  };

  const cancel = () => {
    if (captureRef.current?.status === "sending") return;
    closePdf();
    setCapture(null);
  };

  const find = async () => {
    const pdf = pdfRef.current;
    const draft = captureRef.current;
    if (pdf === null || draft === null) return;
    dispatch({ type: "notice", notice: { kind: "searching" } });
    const found = await searchQuote(pdf, draft.quote, 600, () => pdfRef.current === pdf);
    if (pdfRef.current !== pdf) return;
    if (found.kind === "short" || found.kind === "missing") { dispatch({ type: "notice", notice: { kind: found.kind } }); return; }
    await showPdfPage(found.page);
    if (found.kind === "found") dispatch({ type: "notice", notice: { kind: "foundOn", page: found.page } });
  };

  const allProofs = Object.values(loads).flatMap((l) => (l.kind === "ready" ? l.proofs : []));

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.count}>{t.heading}</h3>
      <p className={styles.muted}>{editable ? t.intro : t.readOnly}</p>
      {citations.length > 0 && (
        <p className={styles.summary}>{t.summary.replace("{n}", String(citedWithProof(citations, allProofs))).replace("{m}", String(citations.length))}</p>
      )}
      {panelError && <p className={styles.error} role="alert">{panelError}</p>}
      <p className={styles.hidden} role="status">{said}</p>
      {sources.length === 0 ? <p className="rail-empty">{t.noSources}</p> : (
        <ul className={styles.sources}>
          {sources.map((source) => (
            <SourceBox key={source.id} source={source} load={loads[source.id] ?? { kind: "loading" }} editable={editable} deps={deps}
              onRetry={() => load(source.id)}
              onPick={(kind) => choose({ sourceId: source.id, label: source.label, kind })}
              onPaste={(event) => {
                const file = editable ? pastedImage(event) : undefined;
                if (!file) return;
                event.preventDefault();
                void openFile({ sourceId: source.id, label: source.label, kind: "image" }, file);
              }}
              onOpen={(proof, picture) => setView({ proof, picture, label: source.label })} />
          ))}
        </ul>
      )}
      <input ref={inputs.camera} aria-label={t.camera} className={styles.hidden} type="file" accept="image/*" capture="environment" tabIndex={-1} aria-hidden="true"
        onChange={(event) => { picked(event.target.files?.[0]); event.target.value = ""; }} />
      <input ref={inputs.image} aria-label={t.image} className={styles.hidden} type="file" accept="image/*" tabIndex={-1} aria-hidden="true"
        onChange={(event) => { picked(event.target.files?.[0]); event.target.value = ""; }} />
      <input ref={inputs.pdf} aria-label={t.pdf} className={styles.hidden} type="file" accept="application/pdf,.pdf" tabIndex={-1} aria-hidden="true"
        onChange={(event) => { picked(event.target.files?.[0]); event.target.value = ""; }} />
      <ProofDialog state={capture} dispatch={dispatch} onSave={() => void save()} onCancel={cancel}
        onPdfPage={(n) => void showPdfPage(n)} onFind={() => void find()} />
      {view && <ProofView {...view} deps={deps} onClose={() => setView(null)} />}
    </section>
  );
}

function SourceBox({ source, load, editable, deps, onRetry, onPick, onPaste, onOpen }: {
  source: ProofSource;
  load: Load;
  editable: boolean;
  deps: ProofsDeps;
  onRetry: () => void;
  onPick: (kind: Choice["kind"]) => void;
  onPaste: (event: ClipboardEvent<HTMLElement>) => void;
  onOpen: (proof: SourceProof, picture: ProofPicture | null) => void;
}) {
  return (
    <li className={styles.source} onPaste={onPaste}>
      <h4>{source.label}</h4>
      {load.kind === "loading" && <p className={styles.muted} role="status">{t.loading}</p>}
      {load.kind === "unavailable" && (
        <div><p className={styles.error} role="alert">{t.unavailable}</p><Button tone="quiet" onClick={onRetry}>{t.retry}</Button></div>
      )}
      {load.kind === "expired" && <p className={styles.error} role="alert">{t.sessionExpired}</p>}
      {load.kind === "ready" && (
        <>
          <p className={styles.count}>{t.sourceProofs.replace("{n}", String(load.proofs.length))}</p>
          {load.proofs.length === 0 ? <p className={styles.muted}>{t.noProofs}</p> : (
            <ul className={styles.thumbs}>
              {load.proofs.map((proof) => <li key={proof.id}><ProofThumb proof={proof} deps={deps} onOpen={onOpen} /></li>)}
            </ul>
          )}
        </>
      )}
      {editable && (
        <>
          <div className={styles.add}>
            <Button tone="quiet" onClick={() => onPick("camera")}>{t.camera}</Button>
            <Button tone="quiet" onClick={() => onPick("image")}>{t.image}</Button>
            <Button tone="quiet" onClick={() => onPick("pdf")}>{t.pdf}</Button>
          </div>
          <p className={styles.muted}>{t.pasteHint}</p>
        </>
      )}
    </li>
  );
}

function PictureCanvas({ picture, className, label }: { picture: ProofPicture; className?: string; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (canvas === null) return;
    canvas.width = picture.width;
    canvas.height = picture.height;
    const ctx = canvas.getContext("2d");
    const all = { x: 0, y: 0, width: picture.width, height: picture.height };
    if (ctx) picture.draw(ctx, all, all);
  }, [picture]);
  return <canvas ref={ref} className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}

function ProofThumb({ proof, deps, onOpen }: { proof: SourceProof; deps: ProofsDeps; onOpen: (proof: SourceProof, picture: ProofPicture | null) => void }) {
  const [picture, setPicture] = useState<ProofPicture | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void deps.picture(proof).then((p) => { if (live) setPicture(p); }, () => { if (live) setPicture(null); });
    return () => { live = false; };
  }, [deps, proof]);
  return (
    <button type="button" className={styles.thumb} aria-label={t.open.replace("{page}", proof.page)} onClick={() => onOpen(proof, picture ?? null)}>
      {picture ? <PictureCanvas picture={picture} className={styles.thumbCanvas} />
        : <span className={styles.missing}>{picture === null ? t.imageMissing : t.loading}</span>}
      <span>{t.page.replace("{page}", proof.page)}</span>
    </button>
  );
}

function ProofView({ proof, picture: shown, label, deps, onClose }: {
  proof: SourceProof; picture: ProofPicture | null; label: string; deps: ProofsDeps; onClose: () => void;
}) {
  const when = zagrebParts(proof.createdAt);
  // Opened before its thumbnail finished: the viewer reads the image itself (undefined while loading).
  const [picture, setPicture] = useState<ProofPicture | null | undefined>(shown ?? undefined);
  useEffect(() => {
    if (shown) return;
    let live = true;
    void deps.picture(proof).then((p) => { if (live) setPicture(p); }, () => { if (live) setPicture(null); });
    return () => { live = false; };
  }, [deps, proof, shown]);
  return (
    <Dialog open title={t.viewTitle} onClose={onClose} actions={<Button onClick={onClose}>{t.close}</Button>}>
      <p>{label}</p>
      <p className={styles.muted}>{t.viewMeta.replace("{page}", proof.page).replace("{when}", when ? `${when.date} ${when.time}` : proof.createdAt)}</p>
      {proof.note && <p>{t.viewNote.replace("{note}", proof.note)}</p>}
      {picture ? <PictureCanvas picture={picture} className={styles.view} label={t.viewAlt.replace("{page}", proof.page)} />
        : picture === undefined ? <p className={styles.muted} role="status">{t.loading}</p>
        : <p className={styles.error}>{t.imageMissing}</p>}
      <p className={styles.muted}>{t.viewDisclaimer}</p>
    </Dialog>
  );
}
