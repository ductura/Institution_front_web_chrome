"use client";

import { Button, Dialog, KeyValueList } from "@ductura/ui";

import { fontText, marginsText, numbersText, spacingText } from "./format-text";
import { pagesMessages as t } from "./messages.hr";
import type { PageFormat } from "./page-format";

type Props = { format: PageFormat; onClose: () => void };

/** Read-only: the page format comes from the faculty rules and the student cannot change it. */
export function PageFormatDialog({ format, onClose }: Props) {
  const origin = (known: boolean) => <small>{known ? t.fromRules : t.general}</small>;
  const row = (id: string, label: string, text: string, known: boolean) =>
    ({ id, label, value: <>{text} {origin(known)}</> });
  return (
    <Dialog open title={t.formatTitle} onClose={onClose} actions={<Button onClick={onClose}>{t.close}</Button>}>
      <p>{format.label || t.noProfile} {t.formatNote}</p>
      <KeyValueList items={[
        row("font", t.font, fontText(format), format.known.font || format.known.size),
        row("spacing", t.spacing, spacingText(format), format.known.spacing),
        row("margins", t.margins, marginsText(format), format.known.margins),
        row("numbers", t.numbers, numbersText(format), format.known.numbering),
      ]} />
      {format.sources.length > 0 && <>
        <h3>{t.rulesHeading}</h3>
        <ul>{format.sources.map((source) => <li key={source}>{source}</li>)}</ul>
      </>}
      <p>{t.breakNote}</p>
    </Dialog>
  );
}
