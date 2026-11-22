"use client";

import { useEffect, useState } from "react";

import { hasSubmission, loadVersions, type N11Port } from "./model";
import { n11Messages as text } from "./messages.hr";

/** The link into N-11 from the live work; rendered only when at least one version was submitted (INVENTAR 3.x). */
export default function N11Entry({ port, documentId, href }: { port: N11Port; documentId: string; href: string }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    let live = true;
    void loadVersions(port, documentId).then((r) => { if (live) setShown(r.kind === "ready" && hasSubmission(r.versions)); });
    return () => { live = false; };
  }, [port, documentId]);
  return shown ? <li><a href={href}>{text.entry}</a></li> : null;
}
