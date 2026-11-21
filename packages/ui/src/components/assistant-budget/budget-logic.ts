/**
 * The student's own use of today's limit (ai-request-v1, "Matrica pristupa": own spend, amount
 * only). Amounts arrive as whole micro-euros in decimal strings (bigint); no amount or limit is
 * a constant here, and money is never shown (s16-bud, PRODUCT §5 rule 15): only the share.
 */
export type BudgetShare = {
  /** 0 to 100, for the bar; capped at 100. */
  readonly percent: number;
  /** "small" below half, "large" from half, "near" from four fifths, "full" at the limit. */
  readonly band: "small" | "large" | "near" | "full";
};

const AMOUNT = /^(0|[1-9][0-9]*)$/u;

/** The share of the limit used, or null when either amount is not a whole micro-euro string or the limit is zero. */
export function budgetShare(usedMicro: string, limitMicro: string): BudgetShare | null {
  if (!AMOUNT.test(usedMicro) || !AMOUNT.test(limitMicro)) return null;
  const used = BigInt(usedMicro);
  const limit = BigInt(limitMicro);
  if (limit === 0n) return null;
  if (used >= limit) return { percent: 100, band: "full" };
  const percent = Number((used * 100n) / limit);
  const band = used * 5n >= limit * 4n ? "near" : used * 2n >= limit ? "large" : "small";
  return { percent, band };
}
