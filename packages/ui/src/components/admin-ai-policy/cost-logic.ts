/**
 * Cost limits an institution administrator publishes (ai-request-v1, `assistant.cost_config_version`):
 * whole micro-euros as decimal strings (bigint). No amount, cap or period is a constant here (OA-2);
 * the only number is the scale of the unit itself, six decimal places of a euro.
 */
const MICRO_DIGITS = 6;
const AMOUNT = /^(0|[1-9][0-9]*)$/u;
const EUR_INPUT = /^([0-9]+)(?:[.,]([0-9]{1,6}))?$/u;

export type CostLimits = {
  readonly studentDayMicro: string;
  readonly studentAssignmentDayMicro: string;
  readonly reserveMicro: string;
};
export type LimitField = keyof CostLimits;
/** `limit_above_cap` is the publish RPC's own reason; the others only the form reports. */
export type LimitError = "invalid" | "limit_above_cap" | "assignment_above_day";

export const LIMIT_FIELDS: readonly LimitField[] = ["studentDayMicro", "studentAssignmentDayMicro", "reserveMicro"];

/** Euro text the administrator typed („0,20”, „20”, „1.5”) as micro-euros, or null when it is not an amount. */
export function eurToMicro(text: string): string | null {
  const match = EUR_INPUT.exec(text.trim());
  if (!match) return null;
  return BigInt(`${match[1]!}${(match[2] ?? "").padEnd(MICRO_DIGITS, "0")}`).toString();
}

/** Micro-euros as euro text with a decimal comma, two to six decimals („0,20”, „1,234567”), or null when malformed. */
export function microToEur(micro: string): string | null {
  if (!AMOUNT.test(micro)) return null;
  const padded = micro.padStart(MICRO_DIGITS + 1, "0");
  const whole = padded.slice(0, -MICRO_DIGITS);
  const fraction = padded.slice(-MICRO_DIGITS).replace(/0+$/u, "").padEnd(2, "0");
  return `${whole},${fraction}`;
}

/**
 * Checks the typed limits against the operator's cap. Every value must be above zero, the per-assignment
 * limit not above the daily one (A-AI-POL state 4), and neither student limit above the cap. Without a
 * cap only the first two hold; the server decides either way.
 */
export function checkLimits(draft: Readonly<Record<LimitField, string>>, capMicro: string | null): {
  limits: CostLimits | null;
  errors: Partial<Record<LimitField, LimitError>>;
} {
  const errors: Partial<Record<LimitField, LimitError>> = {};
  const values: Partial<Record<LimitField, bigint>> = {};
  for (const field of LIMIT_FIELDS) {
    const micro = eurToMicro(draft[field]);
    if (micro === null || micro === "0") errors[field] = "invalid";
    else values[field] = BigInt(micro);
  }
  const cap = capMicro !== null && AMOUNT.test(capMicro) ? BigInt(capMicro) : null;
  const day = values.studentDayMicro;
  const assignment = values.studentAssignmentDayMicro;
  if (cap !== null && day !== undefined && day > cap) errors.studentDayMicro = "limit_above_cap";
  if (cap !== null && assignment !== undefined && assignment > cap) errors.studentAssignmentDayMicro = "limit_above_cap";
  else if (day !== undefined && assignment !== undefined && assignment > day) errors.studentAssignmentDayMicro = "assignment_above_day";
  const reserve = values.reserveMicro;
  if (Object.keys(errors).length > 0 || day === undefined || assignment === undefined || reserve === undefined) return { limits: null, errors };
  return { limits: { studentDayMicro: day.toString(), studentAssignmentDayMicro: assignment.toString(), reserveMicro: reserve.toString() }, errors };
}
