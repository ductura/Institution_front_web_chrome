"use client";

import { useEffect, useState } from "react";

import { buildElements, type Elements } from "./model";
import { readVersionedDocument, type ElementsRead } from "./reader";

const REFRESH_MS = 5000;

/**
 * The text elements of a work, read while `enabled` (the shared live view could not show the
 * document). `elements` is null until a versioned document with citations or footnotes is read;
 * `unavailable` is true while the last read failed, so the page can say so instead of staying silent.
 */
export function useTextElements(documentId: string, enabled: boolean, current: () => boolean = () => true) {
  const [read, setRead] = useState<ElementsRead | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      const next = await readVersionedDocument(documentId);
      if (!active || !current()) return;
      setRead(next);
      if (next.kind !== "signedOut" && next.kind !== "notFound") timer = setTimeout(() => void tick(), REFRESH_MS);
    };
    void tick();
    return () => { active = false; if (timer !== undefined) clearTimeout(timer); };
  }, [documentId, enabled, current]);
  const elements: Elements | null = read?.kind === "document" ? buildElements(read.document) : null;
  return { elements: elements?.hasElements ? elements : null, unavailable: enabled && read?.kind === "unavailable" };
}
