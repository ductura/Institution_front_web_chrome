"use client";

// WEB-1803 (M8.5): "Preuzmi PDF" in the print preview. The "PDF/A" mark is drawn only when the server's
// answer says so; it is never assumed.
import { createApi, goToSignIn } from "../../../../../../src/client/api";
import { appHref } from "../../../../../../src/components/shell/nav";
import { useHost } from "../../context";
import { downloadFromServer, pdfCalls, pdfDownloadPrefix, pdfFileName, type PrepareCall } from "./contract";
import { pdfExportText } from "./messages.hr";
import { PreparationControl } from "./PreparationControl";

/** TODO(ugovor): until the routes are published createApi answers "client_rejected" and the screen says "unavailable". */
const defaultCall = () => createApi() as unknown as PrepareCall;

export type PdfExportVersion = { readonly documentId: string; readonly versionId: string; readonly title: string };

export default function PdfExport({ version, here, call = defaultCall }: {
  version: PdfExportVersion;
  /** The path of the screen, for the way back after sign-in. */
  here: string;
  call?: () => PrepareCall;
}) {
  const { base } = useHost();
  return (
    <PreparationControl
      text={pdfExportText}
      makeCalls={(key) => pdfCalls(call(), version.documentId, version.versionId, key)}
      download={downloadFromServer}
      downloadPrefix={pdfDownloadPrefix(version.documentId)}
      fileName={pdfFileName(version.title)}
      onSignedOut={() => goToSignIn(appHref(base, here))}
    />
  );
}
