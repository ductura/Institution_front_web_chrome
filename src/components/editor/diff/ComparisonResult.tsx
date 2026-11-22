import { DiffView } from "@ductura/ui";

import { countWords, type Comparison } from "./comparison-read";
import { comparisonHr as t } from "./messages.hr";

const wrap = { whiteSpace: "pre-wrap", overflowWrap: "anywhere" } as const;

export function ComparisonResult({ comparison, onlyChanges }: { comparison: Comparison; onlyChanges: boolean }) {
  const { blocks } = comparison;
  const { addedWords, removedWords } = countWords(comparison);
  const changed = blocks.some(({ change }) => change !== "unchanged");
  const visible = onlyChanges ? blocks.filter(({ change }) => change !== "unchanged") : blocks;
  return (
    <>
      <p role="status">{t.added(addedWords)} · {t.removed(removedWords)}</p>
      {!changed && <p>{t.noChanges}</p>}
      {visible.map(({ change, text }, index) => change === "unchanged" ? (
        <p key={index} style={wrap}>{text}</p>
      ) : <DiffView key={index} parts={[{ kind: change, text }]} />)}
    </>
  );
}
