"use client";

import { Button, Notice } from "@ductura/ui";
import { useCallback, useContext, useEffect, useRef, useState } from "react";

import { goToSignIn } from "@/client/api";
import { appHref, homeHref } from "@/components/index";

import { messagesHr as app } from "../../../../../locales/hr.ts";
import { HostContext } from "../context";
import { DeniedState, LoadAlert } from "../states/States";

import { readCatalogue, type CatalogueState } from "./api/read";
import { runAnalysis, type AnalysisRequest, type AnalysisRunState } from "./api/run";
import { ChooseAnalysis } from "./choose/ChooseAnalysis";
import type { Dataset } from "./choose/build-request";
import { DatasetLoader } from "./dataset/DatasetLoader";
import { analysisPageMessages as t } from "./messages.hr";
import styles from "./analysis-page.module.css";
import { ResultView } from "./result/ResultView";
import { SamplePicker } from "./samples/SamplePicker";

export type Step = "dataset" | "analysis" | "result";
export const STEPS: readonly Step[] = ["dataset", "analysis", "result"];

/** Whether a step may be entered: the analysis needs a set, the result needs a calculation that was started. Pure. */
export function canEnter(step: Step, dataset: Dataset | null, run: AnalysisRunState | null): boolean {
  if (step === "dataset") return true;
  if (step === "analysis") return dataset !== null;
  return dataset !== null && run !== null;
}

export type AnalysisPageProps = {
  /** Reading the catalogue and running a calculation; the real routes by default, a stand-in in tests. */
  read?: () => Promise<Exclude<CatalogueState, { kind: "loading" }>>;
  run?: (request: AnalysisRequest) => Promise<Exclude<AnalysisRunState, { kind: "loading" }>>;
};

/**
 * WEB-V15-STRANICA: "Statistička analiza" in three steps (set, analysis, result) put together from the parts of the
 * folders `dataset`, `samples`, `choose` and `result`. The set lives only in this component's state and is sent only in
 * the body of a calculation; nothing is written in the browser. A switched-off function (404) is shown as a notice, not
 * as an error.
 */
export function AnalysisPage({ read = () => readCatalogue(), run = (request) => runAnalysis(request) }: AnalysisPageProps) {
  const host = useContext(HostContext);
  const [catalogue, setCatalogue] = useState<CatalogueState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [step, setStep] = useState<Step>("dataset");
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [result, setResult] = useState<AnalysisRunState | null>(null);
  const [toastOpen, setToastOpen] = useState(false);
  const lastRequest = useRef<AnalysisRequest | null>(null);
  const generation = useRef(0);
  // A sample replaces the set, so the loader (which keeps its own preview) starts over with a new key.
  const [loaderKey, setLoaderKey] = useState(0);

  useEffect(() => {
    let live = true;
    setCatalogue({ kind: "loading" });
    void read().then((value) => {
      if (live) setCatalogue(value);
    });
    return () => {
      live = false;
    };
    // `read` is a fresh closure each render; the attempt is what asks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // 401: the page does not show an error, it goes to sign-in (AAI@EduHr) and comes back here.
  const signedOut = catalogue.kind === "signedOut";
  useEffect(() => {
    if (signedOut) goToSignIn(appHref(host?.base ?? "", "/analiza"));
  }, [signedOut, host]);

  const forget = useCallback(() => {
    generation.current += 1;
    lastRequest.current = null;
    setResult(null);
  }, []);
  const load = (next: Dataset) => {
    forget();
    setDataset(next);
    setStep("dataset");
  };
  const go = (target: Step) => {
    if (canEnter(target, dataset, result)) setStep(target);
  };
  const calculate = (request: AnalysisRequest) => {
    const mine = ++generation.current;
    lastRequest.current = request;
    setResult({ kind: "loading" });
    setStep("result");
    void run(request).then((value) => {
      if (mine === generation.current) setResult(value);
    });
  };

  if (catalogue.kind === "loading") return <PageFrame><p role="status">{t.loading}</p></PageFrame>;
  if (catalogue.kind === "off") {
    return <PageFrame><Notice tone="info"><strong>{t.off}</strong> {t.offBody}</Notice></PageFrame>;
  }
  if (catalogue.kind === "signedOut") return <PageFrame><p role="status">{t.loading}</p></PageFrame>;
  if (catalogue.kind === "denied") {
    return (
      <section className="page">
        <DeniedState title={app.access.deniedTitle} backLabel={app.access.backToOwn} backHref={appHref(host?.base ?? "", homeHref(host?.role ?? null))} />
      </section>
    );
  }
  if (catalogue.kind !== "ready") {
    return (
      <PageFrame>
        <LoadAlert
          body={catalogue.kind === "unavailable" ? t.unavailable : t.failed}
          retry={{ label: t.retry, onRetry: () => setAttempt((n) => n + 1) }}
        />
      </PageFrame>
    );
  }

  const index = STEPS.indexOf(step);
  return (
    <PageFrame className={toastOpen ? styles.toastRoom : undefined}>
      <ol aria-label={t.stepsLabel}>
        {STEPS.map((entry) => (
          <li key={entry} aria-current={entry === step ? "step" : undefined}>{t.steps[entry]}</li>
        ))}
      </ol>
      <p>{t.stepOf.replace("{n}", String(index + 1))}</p>
      {step === "dataset" && (
        <>
          <DatasetLoader key={loaderKey} onLoaded={load} onCleared={() => { forget(); setDataset(null); }} />
          <SamplePicker onLoaded={(next) => { setLoaderKey((n) => n + 1); load(next); }} />
          {dataset === null && <p role="status">{t.needDataset}</p>}
          <Button disabled={!canEnter("analysis", dataset, result)} onClick={() => go("analysis")}>{t.next}</Button>
        </>
      )}
      {step === "analysis" && dataset !== null && (
        <>
          <ChooseAnalysis catalogue={catalogue.data} dataset={dataset} onChoose={calculate} />
          <Button tone="ghost" onClick={() => go("dataset")}>{t.back}</Button>
        </>
      )}
      {step === "result" && (
        <>
          {result !== null && (
            <ResultView state={result} onToastOpen={setToastOpen} onRetry={lastRequest.current === null ? undefined : () => calculate(lastRequest.current!)} />
          )}
          {result === null && <p role="status">{t.needRun}</p>}
          <Button tone="ghost" onClick={() => go("analysis")}>{t.back}</Button>
          <Button tone="ghost" onClick={() => { forget(); setStep("dataset"); }}>{t.newAnalysis}</Button>
        </>
      )}
    </PageFrame>
  );
}

function PageFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={className === undefined ? "page" : `page ${className}`}>
      <h1>{t.title}</h1>
      <p>{t.lead}</p>
      <Notice tone="info">{t.notSaved} ({t.inventedBadge})</Notice>
      {children}
    </section>
  );
}

export default AnalysisPage;
