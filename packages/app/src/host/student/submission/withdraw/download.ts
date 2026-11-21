import { receiptFile } from "./model";
import type { WithdrawalReceipt } from "./contract";

/** Saves the confirmation as a file from the browser's memory; no request is made. */
export function downloadReceipt(receipt: WithdrawalReceipt): void {
  const file = receiptFile(receipt);
  const url = URL.createObjectURL(new Blob([file.content], { type: file.type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
