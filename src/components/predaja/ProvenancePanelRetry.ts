"use client";

/**
 * The teacher's submission page is a server component and cannot hand a function to the panel, so
 * this thin client wrapper gives `ProvenancePanel` its `onRetry`: a new read of the page, which
 * reads the record again (N-AI-ATT). The read itself is plain data and crosses over as it is.
 * It is a wiring file, not a screen, so it has no catalogue entry (the panel it wraps has one).
 */

import { useRouter } from "next/navigation";
import { createElement } from "react";

import type { ProvenanceRead } from "../../client/provenance";

import { ProvenancePanel } from "./ProvenancePanel";

export function ProvenancePanelRetry({ read, showMatch }: { readonly read: ProvenanceRead; readonly showMatch?: boolean }) {
  const router = useRouter();
  return createElement(ProvenancePanel, { read, showMatch, onRetry: () => router.refresh() });
}
