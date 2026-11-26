"use client";

// WEB-1803 (M8.6; WEB-2004): on the receipt of a submitted work, the package for the registrar's office.
// The server gives a link that expires; the screen shows it with the expiry the server states.
import { useEffect, useState } from "react";
import { Button, Card } from "@ductura/ui";

import { createApi, goToSignIn } from "../../../../../../src/client/api";
import { appHref } from "../../../../../../src/components/shell/nav";
import { formatDateTimeHr } from "../../../../../../src/lib/i18n/hr";
import { useHost } from "../../context";
import { PACKAGE_KIND, requestPackageLink, type PackageCall, type PackageKind, type PackageLink } from "./contract";
import { portablePackageText, submissionPackageText } from "./messages.hr";

const defaultCall = () => createApi() as unknown as PackageCall;

export default function SubmissionPackage(
  { assignmentId, submissionId, kind = PACKAGE_KIND, call = defaultCall, now = () => new Date() }:
  { assignmentId: string; submissionId: string; kind?: PackageKind; call?: () => PackageCall; now?: () => Date },
) {
  // The registrar's package by default; the portfolio asks for the verifiable package (WEB-1807).
  const t = kind === "package" ? portablePackageText : submissionPackageText;
  const { base } = useHost();
  const [link, setLink] = useState<{ submissionId: string; link: PackageLink } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const current = link?.submissionId === submissionId ? link.link : null;

  useEffect(() => {
    setBusy(false);
    setNote(null);
    setLink(null);
  }, [submissionId]);

  async function request() {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const asked = submissionId;
    const outcome = await requestPackageLink(call(), asked, kind);
    setBusy(false);
    if (outcome.kind === "poveznica") setLink((cur) => (cur === null || cur.submissionId === asked ? { submissionId: asked, link: outcome.link } : cur));
    else if (outcome.kind === "session-expired") goToSignIn(appHref(base, `/rad/${encodeURIComponent(assignmentId)}/predaja/potvrda`));
    else setNote(outcome.kind === "greska" ? t.notFound : t.unknown);
  }

  const expired = current !== null && Date.parse(current.expiresAt) <= now().getTime();
  return (
    <Card title={t.title}>
      <p>{t.lead}</p>
      {current !== null && !expired ? (
        <>
          <p role="status">{t.ready}</p>
          <a href={current.href} download>{t.download}</a>
          <p>{t.expiresAt} {formatDateTimeHr(current.expiresAt)}.</p>
        </>
      ) : (
        <>
          {expired && <p role="alert">{t.expired}</p>}
          <Button onClick={() => void request()} disabled={busy}>{expired ? t.requestAgain : t.start}</Button>
        </>
      )}
      {busy && <p role="status">{t.requesting}</p>}
      {note !== null && <p role="alert">{note}</p>}
    </Card>
  );
}
