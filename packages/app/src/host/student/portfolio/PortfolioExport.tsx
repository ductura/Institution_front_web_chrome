"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@ductura/ui";

import { goToSignIn } from "../../../../../../src/client/api";
import { appHref } from "../../../../../../src/components/shell/nav";
import { useHost } from "../../context";
import PdfExport from "../../editor/export/PdfExport";
import PortableRecord from "../portable-record/PortableRecord";
import { loadPortfolio, submittedDate, type PortfolioPort, type PortfolioView } from "./model";
import { portfolioText as t } from "./messages.hr";

/** "Izvoz za portfelj" (WEB-1807; M10.11): per submitted version the PDF and the verifiable package, existing routes only. */
export default function PortfolioExport({ port }: { port: PortfolioPort }) {
  const { base } = useHost();
  const [view, setView] = useState<PortfolioView | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setView(null);
    void loadPortfolio(port).then((next) => { if (active) setView(next); });
    return () => { active = false; };
  }, [port, attempt]);

  useEffect(() => {
    if (view?.kind === "signedOut") goToSignIn(appHref(base, "/portfelj"));
  }, [view, base]);

  return (
    <section aria-labelledby="portfolio-title">
      <h2 id="portfolio-title">{t.title}</h2>
      <p>{t.lead}</p>
      {view === null ? <p role="status">{t.loading}</p> : null}
      {view?.kind === "empty" ? <p>{t.empty}</p> : null}
      {view?.kind === "signedOut" ? <p role="alert">{t.signedOut}</p> : null}
      {view?.kind === "unavailable" ? <><p role="alert">{t.unavailable}</p><Button onClick={() => setAttempt((n) => n + 1)}>{t.retry}</Button></> : null}
      {view?.kind === "ready" ? (
        <ul>
          {view.entries.map((e) => (
            <li key={e.submissionId}>
              <Card title={e.title}>
                <p>{t.submittedOn(submittedDate(e.submittedAt))}</p>
                {e.courseEnded ? <p>{t.courseEnded}</p> : null}
                <h3>{t.pdfHeading}</h3>
                <PdfExport assignmentId={e.assignmentId} version={{ documentId: e.documentId, versionId: e.versionId, title: e.title }} here="/portfelj" />
                <h3>{t.packageHeading}</h3>
                <p>{t.packageLead}</p>
                <PortableRecord submissionId={e.submissionId} />
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
