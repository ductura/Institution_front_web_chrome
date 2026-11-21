"use client";

// WEB-1803 (M8.6): on the receipt of a submitted work, the package for the registrar's office.
import { Card } from "@ductura/ui";

import { createApi, goToSignIn } from "../../../../../../src/client/api";
import { appHref } from "../../../../../../src/components/shell/nav";
import { downloadFromServer } from "../../editor/export/contract";
import { PreparationControl } from "../../editor/export/PreparationControl";
import { useHost } from "../../context";
import { packageCalls, packageDownloadPrefix, packageFileName, type PackageCall } from "./contract";
import { submissionPackageText as t } from "./messages.hr";

/** TODO(ugovor): until the routes are published createApi answers "client_rejected" and the screen says "unavailable". */
const defaultCall = () => createApi() as unknown as PackageCall;

export default function SubmissionPackage({ assignmentId, call = defaultCall }: { assignmentId: string; call?: () => PackageCall }) {
  const { base } = useHost();
  return (
    <Card title={t.title}>
      <p>{t.lead}</p>
      <PreparationControl
        text={t}
        makeCalls={(key) => packageCalls(call(), assignmentId, key)}
        download={downloadFromServer}
        downloadPrefix={packageDownloadPrefix(assignmentId)}
        fileName={packageFileName(assignmentId)}
        onSignedOut={() => goToSignIn(appHref(base, `/rad/${encodeURIComponent(assignmentId)}/predaja/potvrda`))}
      />
    </Card>
  );
}
