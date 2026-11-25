"use client";

// WEB-V21-DRU-KOSTUR: the student confirms and picks the sections; nothing is inserted before the confirmation.
import { useState } from "react";
import { Button, Checkbox, Dialog } from "@ductura/ui";
import type { Editor } from "@tiptap/core";

import type { RuleProfile } from "../../rules/profiles";
import { skeletonMessages as t } from "./messages.hr";
import { applySkeleton, presentTitles, skeletonSections } from "./skeleton";

/** Mount on opening: the document is read once, and a change under the dialog makes the confirmation refuse. */
export function SkeletonDialog({ editor, profile, onClose }: { editor: Editor; profile: RuleProfile | null; onClose: () => void }) {
  const [initial] = useState(() => {
    const titles = skeletonSections(profile);
    return { doc: editor.state.doc, titles, present: presentTitles(editor.state.doc, titles) };
  });
  const open = initial.titles.filter((title) => !initial.present.has(title));
  const [picked, setPicked] = useState<readonly string[]>(open);
  const [error, setError] = useState<string>();
  const confirm = () => {
    if (editor.state.doc !== initial.doc || applySkeleton(editor, picked) === null) { setError(t.applyError); return; }
    onClose();
  };
  return (
    <Dialog open title={t.title} error={error} onClose={onClose} actions={<>
      <Button tone="quiet" onClick={onClose}>{t.cancel}</Button>
      <Button disabled={picked.length === 0} onClick={confirm}>{t.confirm}</Button>
    </>}>
      <p>{open.length === 0 ? t.none : t.intro}</p>
      {initial.titles.map((title) => initial.present.has(title)
        ? <Checkbox key={title} label={`${title} (${t.present})`} checked disabled onChange={() => undefined} />
        : <Checkbox key={title} label={title} checked={picked.includes(title)}
            onChange={(e) => { setError(undefined); setPicked((p) => e.target.checked ? [...p, title] : p.filter((x) => x !== title)); }} />)}
    </Dialog>
  );
}
