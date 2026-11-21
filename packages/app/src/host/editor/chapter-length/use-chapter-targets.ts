"use client";

import { useEffect, useState } from "react";

import { assignmentIdOf } from "../../../../../../src/components/editor/EditorPage.read.ts";
import { readChapterTargets } from "./assignment-rules";
import type { ChapterTargets } from "./chapter-length";

const NO_TARGETS: ChapterTargets = new Map();

export function useChapterTargets(enabled: boolean): ChapterTargets {
  const [targets, setTargets] = useState<ChapterTargets>(NO_TARGETS);

  useEffect(() => {
    // The editor surface remounts with the document. It also runs outside Next in the layout fixture.
    const match = /^(?:\/app\/(?:web|chrome))?\/rad\/([^/]+)\/?$/u.exec(window.location.pathname);
    const assignmentId = assignmentIdOf(match?.[1] ?? "");
    if (!enabled || !assignmentId) return;
    let active = true;
    void readChapterTargets(assignmentId).then((targets) => {
      if (active) setTargets(targets);
    });
    return () => { active = false; };
  }, [enabled]);

  return enabled ? targets : NO_TARGETS;
}
