"use client";

// NF-3 PR-15 (E-11c, G-23): "Moje predaje", read only. Each submission with its attempt and time,
// the one in force with its receipt, a withdrawn one with its signed confirmation of withdrawal.
import { Button, Card } from "@ductura/ui";

import { downloadBlob } from "../../../../../../../src/components/editor/EarlierDraft";
import StepLink from "../steps/StepLink";
import type { SignedWithdrawalReceipt, WithdrawalReceipt } from "../withdraw/contract";
import { receiptFile } from "../withdraw/model";
import type { HistoryRead } from "./contract";
import { historyText as t } from "./messages.hr";
import { historyRows } from "./model";

/** The signed withdrawal from the history, saved as the withdrawal card saves it; no request is made. */
function save(receipt: SignedWithdrawalReceipt): void {
  const { withdrawalId, assignmentId, withdrawnAt } = receipt.payload;
  const summary: WithdrawalReceipt = { withdrawalId, assignmentId, revision: null, withdrawnAt, signature: receipt.signature.signatureBase64Url, envelope: receipt };
  const file = receiptFile(summary);
  downloadBlob(new Blob([file.content], { type: file.type }), file.filename);
}

export default function MySubmissions({ read, receiptHref, onRetry }: { read: HistoryRead | null; receiptHref: string; onRetry: () => void }) {
  if (read === null || read.kind === "session-expired") return null;
  if (read.kind === "nepoznato") {
    return (
      <Card level={2} title={t.title}>
        <p role="alert">{t.unavailable}</p>
        <p><Button tone="quiet" onClick={onRetry}>{t.retry}</Button></p>
      </Card>
    );
  }
  const rows = historyRows(read.history.events);
  if (rows.length === 0) return null;
  return (
    <Card level={2} title={t.title}>
      <ul data-testid="my-submissions">
        {rows.map((row) => (
          <li key={row.key}>
            <p>{row.line}</p>
            {row.state.kind === "current" && (
              <>
                <p>{t.current}</p>
                <StepLink href={receiptHref}>{t.openReceipt}</StepLink>
              </>
            )}
            {row.state.kind === "earlier" && <p>{t.earlier}</p>}
            {row.state.kind === "withdrawn" && (
              <>
                <p>{row.state.line}</p>
                {row.state.receipt !== null && (() => {
                  const receipt = row.state.receipt;
                  return (
                    <Button tone="quiet" aria-label={t.downloadWithdrawalFor.replace("{n}", String(row.attempt))} onClick={() => save(receipt)}>
                      {t.downloadWithdrawal}
                    </Button>
                  );
                })()}
              </>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
