"use client";

import { useMemo, useState } from "react";
import { Button, Dialog } from "@ductura/ui";
import { useEditorState, type Editor } from "@tiptap/react";

import { citationMessagesHr as t } from "./messages.hr";
import { reviewPlaces } from "./review-places";

export function ReviewPlaces({ editor }: { editor: Editor | null }) {
  const [open, setOpen] = useState(false);
  const doc = useEditorState({ editor, selector: ({ editor }) => editor?.state.doc ?? null,
    equalityFn: (previous, next) => previous === next });
  const places = useMemo(() => doc ? reviewPlaces(doc) : [], [doc]);
  const close = () => setOpen(false);
  if (!editor || editor.isDestroyed) return null;

  return <>
    <Button tone="quiet" onClick={() => setOpen(true)} aria-haspopup="dialog">
      {places.length ? t.reviewCount.replace("{count}", String(places.length)) : t.review}
    </Button>
    <Dialog open={open} title={t.review} onClose={close}
      actions={<Button onClick={close}>{t.close}</Button>}>
      {places.length ? <>
        <p>{t.reviewIntro}</p>
        <ul>
          {places.map(({ from, to, chapter, context }) => <li key={from}>
            <Button tone="quiet" onClick={() => {
              if (editor.isDestroyed || editor.state.doc !== doc) return;
              close();
              editor.chain().setTextSelection({ from, to }).scrollIntoView().focus().run();
            }}>
              {chapter ? t.chapter.replace("{number}", chapter) : t.beforeChapter} · {context}
            </Button>
          </li>)}
        </ul>
      </> : <p>{t.reviewEmpty}</p>}
    </Dialog>
  </>;
}
