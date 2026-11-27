// WEB-DIZ-B-V21: the "Kostur rada" item follows the document: a heading renamed or removed changes which sections
// are present, and the toolbar's own snapshot does not look at the text, so this listens to the editor itself.
import type { Editor } from "@tiptap/core";
import { useEffect, useState } from "react";

import type { RuleProfile } from "../../rules/profiles";
import { skeletonAvailability, type SkeletonAvailability } from "./skeleton";

export function useSkeletonAvailability(editor: Editor | null, profile: RuleProfile | null): SkeletonAvailability {
  const [, setVersion] = useState(0);
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const bump = () => setVersion((n) => n + 1);
    editor.on("update", bump);
    return () => { if (!editor.isDestroyed) editor.off("update", bump); };
  }, [editor]);
  return skeletonAvailability(editor, profile);
}
