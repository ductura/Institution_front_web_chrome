"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { readChapterTargets } from "./assignment-rules";
import type { ChapterTargets } from "./chapter-length";

const NO_TARGETS: ChapterTargets = new Map();

export function useChapterTargets(enabled: boolean): ChapterTargets {
  const assignmentId = useParams<{ assignmentId?: string }>()?.assignmentId;
  const [read, setRead] = useState<{ assignmentId: string; targets: ChapterTargets } | null>(null);

  useEffect(() => {
    if (!enabled || !assignmentId) return;
    let active = true;
    void readChapterTargets(assignmentId).then((targets) => {
      if (active) setRead({ assignmentId, targets });
    });
    return () => { active = false; };
  }, [assignmentId, enabled]);

  return enabled && read && read.assignmentId === assignmentId ? read.targets : NO_TARGETS;
}
