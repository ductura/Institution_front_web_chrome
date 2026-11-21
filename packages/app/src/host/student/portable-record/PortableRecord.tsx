"use client";

import { PortableRecordCard, type PortableRecordState } from "@ductura/ui";
import { useState } from "react";

import { browserTransport, goToSignIn } from "../../../../../../src/client/api";
import { downloadBlob } from "../../../../../../src/components/editor/EarlierDraft.tsx";
import { fetchRecord, portableRecordLabels } from "./model";

/** "Prenosivi zapis" on the confirmation of submission (WEB-1304; M7.10). */
export default function PortableRecord({ submissionId }: { submissionId: string }) {
  const [state, setState] = useState<PortableRecordState>({ kind: "ready" });

  const download = async () => {
    setState({ kind: "downloading" });
    const { state: next, file } = await fetchRecord(submissionId, { baseUrl: window.location.origin, transport: browserTransport });
    if (next === "signedOut") {
      goToSignIn(window.location.pathname);
      return;
    }
    if (file !== null) downloadBlob(new Blob([file.bytes], { type: file.type }), file.filename);
    setState(next);
  };

  return <PortableRecordCard state={state} labels={portableRecordLabels} onDownload={() => { void download(); }} />;
}
