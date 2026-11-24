// WEB-NF6-RUNDA (NF-6 MK-10): the reads behind "Složi iz rada" and the send of the preparation as a message
// to the mentor (work.messages.post). Every request goes through the shared client in src/client.
import { readConsultations } from "../../../../../../src/client/consultation-records";
import { listRevisionRequests } from "../../../../../../src/client/revision-requests";
import { readTimeMachineComparison, readTimeMachineVersions } from "../../../../../../src/client/time-machine";
import { sendWorkMessage } from "../../../../../../src/client/work-messages";

import type { PrepInput } from "./mentor-model";
import { lastRecord, prepFrom, type BlockChange } from "./prep-model";

export type SendOutcome = "sent" | "signedOut" | "failed";

export type PrepPort = {
  /** null when nothing the preparation is made of could be read. */
  compose(words: number | null): Promise<PrepInput | null>;
  send(text: string): Promise<SendOutcome>;
};

const quiet = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

export function prepPort(documentId: string): PrepPort {
  return {
    async compose(words) {
      const [records, list, versions] = await Promise.all([
        quiet(readConsultations(documentId)), quiet(listRevisionRequests(documentId)), quiet(readTimeMachineVersions(documentId)),
      ]);
      const requests = list?.kind === "ok" ? list.requests : null;
      if (records === null && requests === null) return null;
      const record = records === null ? null : lastRecord(records);
      const latest = versions?.kind === "ready" ? Math.max(0, ...versions.versions.map((v) => v.revision)) : 0;
      let blocks: readonly BlockChange[] | null = null;
      if (record !== null && latest > record.revision) {
        const compared = await quiet(readTimeMachineComparison(documentId, record.revision, latest));
        blocks = compared?.kind === "ready" ? compared.blocks : null;
      }
      return prepFrom({ record, blocks, requests, words });
    },
    async send(text) {
      try {
        const answer = await sendWorkMessage(documentId, text);
        // A stored message is sent, even if the server normalised its text: "failed" would invite a second send.
        if (answer.ok) return "sent";
        return answer.status === 401 ? "signedOut" : "failed";
      } catch {
        return "failed";
      }
    },
  };
}
