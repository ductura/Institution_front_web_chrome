import { DiffView } from "@ductura/ui";

import type { Comparison } from "./comparison-read";
import { comparisonHr as t } from "./messages.hr";

export function ComparisonResult({ comparison, onlyChanges }: { comparison: Comparison; onlyChanges: boolean }) {
  const { blocks, counts, truncated } = comparison;
  const visible = onlyChanges ? blocks.filter((block) => block.op !== "same") : blocks;
  return (
    <>
      <p role="status">{t.added(counts.addedWords)} · {t.removed(counts.removedWords)}</p>
      {truncated && <p role="status">{t.truncated}</p>}
      {!truncated && !blocks.some(({ op }) => op !== "same") && <p>{t.noChanges}</p>}
      {visible.map(({ op, words }, index) => op === "same" ? (
        <p key={index} style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{words.map(({ text }) => text).join("")}</p>
      ) : <DiffView key={index} parts={words.map(({ op: kind, text }) => ({ kind, text }))} />)}
    </>
  );
}
