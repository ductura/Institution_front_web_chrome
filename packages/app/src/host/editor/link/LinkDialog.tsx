"use client";

// ED-127: the address of a link on the selected text (the prototype's acLink prompt, as a dialog).
import { Button, Dialog, TextField } from "@ductura/ui";
import { useState } from "react";

import { linkHr } from "./messages.hr";

export function LinkDialog({ initial, onSave, onClose }: {
  initial: string;
  /** False when the address was refused; the dialog stays open and says so. */
  onSave: (href: string) => boolean;
  onClose: () => void;
}) {
  const [href, setHref] = useState(initial);
  const [refused, setRefused] = useState(false);
  const save = () => { if (!onSave(href)) setRefused(true); };
  return (
    <Dialog open title={linkHr.title} onClose={onClose}
      actions={<>
        <Button tone="quiet" onClick={onClose}>{linkHr.cancel}</Button>
        <Button disabled={href.trim() === ""} onClick={save}>{linkHr.save}</Button>
      </>}>
      <TextField label={linkHr.address} value={href} placeholder={linkHr.placeholder} type="url" inputMode="url"
        autoComplete="off" spellCheck={false} hint={linkHr.hint} error={refused ? linkHr.invalid : undefined}
        onChange={(event) => { setHref(event.target.value); setRefused(false); }}
        onKeyDown={(event) => { if (event.key === "Enter" && href.trim() !== "") { event.preventDefault(); save(); } }} />
    </Dialog>
  );
}
