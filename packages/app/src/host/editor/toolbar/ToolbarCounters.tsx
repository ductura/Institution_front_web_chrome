"use client";

// ED-101 (prototype toolbar2.js cntHole, cntCmt, cntSrc, tbSend): the counters on the bar jump to the next place of
// their kind; "Pošalji mentoru" opens "Prije slanja mentoru" with what still waits. Nothing here changes the text.
import { useEffect, useRef, useState } from "react";
import { Button, Popover } from "@ductura/ui";
import type { Editor } from "@tiptap/core";

import { commentHighlightKey } from "../../../../../editor-core/src/editor/comment-anchor.ts";
import { allPlaces, nextPlace, type Place } from "../marks/marks-model";
import { COUNTER_KIND, counterButtons, countsOf, sendRows, waiting, type CounterId, type Counts } from "./counters";
import { toolbarBehaviourHr as hr } from "./messages.hr";

const NONE: Counts = { cntHole: 0, cntCmt: 0, cntSrc: 0 };

function placesOf(editor: Editor): Place[] {
  const set = commentHighlightKey.getState(editor.state);
  const comments = set ? set.find().map((d) => ({ from: d.from, to: d.to })) : [];
  return allPlaces(editor.state.doc, comments);
}

/** The counts, read again on every transaction and kept while they stay the same. */
function useCounts(editor: Editor | null): Counts {
  const [counts, setCounts] = useState<Counts>(NONE);
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const read = () => setCounts((was) => {
      const next = countsOf(placesOf(editor));
      return JSON.stringify(was) === JSON.stringify(next) ? was : next;
    });
    read();
    editor.on("transaction", read);
    return () => { editor.off("transaction", read); };
  }, [editor]);
  return counts;
}

/** Puts the selection on the next place of the counter's kind, wrapping to the first. */
export function jumpToNext(editor: Editor | null, id: CounterId): boolean {
  if (!editor || editor.isDestroyed) return false;
  const target = nextPlace(placesOf(editor), COUNTER_KIND[id], editor.state.selection.to);
  if (!target) return false;
  editor.chain().setTextSelection({ from: target.from, to: target.to }).scrollIntoView().focus().run();
  return true;
}

export function ToolbarCounters({ editor }: { editor: Editor | null }) {
  const counts = useCounts(editor);
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const total = waiting(counts);
  const rows = sendRows(counts);
  const go = (id: CounterId) => { setOpen(false); jumpToNext(editor, id); };

  return (
    <span role="group" aria-label={hr.counters} data-counters="">
      {counterButtons(counts).map((b) => (
        <Button key={b.id} tone="quiet" data-counter={b.id} title={b.tip} aria-label={`${b.label}: ${b.count}`} onClick={() => go(b.id)}>
          {b.label} <span aria-hidden="true">{b.count}</span>
        </Button>
      ))}
      <Button ref={anchor} tone="quiet" aria-haspopup="dialog" aria-expanded={open} title={hr.tbSendTip}
        aria-label={total ? `${hr.tbSend}: ${total}` : hr.tbSend} onClick={() => setOpen((o) => !o)}>
        {hr.tbSend}{total ? <span aria-hidden="true"> {total}</span> : null}
      </Button>
      <Popover open={open} anchor={anchor} label={hr.sendTitle} onClose={() => setOpen(false)}>
        <h3>{hr.sendTitle}</h3>
        {rows.length ? (
          <ul>{rows.map((r) => (
            <li key={r.id}><Button tone="quiet" onClick={() => go(r.id)}>{r.text} <small>{r.note}</small></Button></li>
          ))}</ul>
        ) : <p>{hr.sendNothing}</p>}
        {rows.length > 0 && <p>{hr.sendNotBlocking}</p>}
        <Button tone="quiet" onClick={() => setOpen(false)}>{hr.sendClose}</Button>
      </Popover>
    </span>
  );
}
