// PIL-D3-NASTAVNIK: the real port of the teacher's submission history and withdrawal switch, over the
// transport the page gives (createApi's, through src/client). It asks teacher.submission-history.get,
// teacher.submission-withdrawal.get and teacher.submission-withdrawal.post as contract.ts names them.
// No network primitive here.
import type { HistoryCall } from "./contract";

/**
 * The transport for SubmissionHistory and WithdrawalSwitch; an ended session (401) calls `onExpired`
 * once per answer that found it. Every other answer goes on as the server gave it: contract.ts checks
 * it against the contract's schema and shows a change only from the server's answer (B-6).
 */
export function historyPort(call: HistoryCall, onExpired: () => void = () => {}): HistoryCall {
  return async (id, input) => {
    const result = await call(id, input);
    if (!result.ok && result.status === 401) onExpired();
    return result;
  };
}
