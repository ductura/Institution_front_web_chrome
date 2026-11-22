// The real port of the version history (PIL-D7-POVIJEST): the three reads of src/client/time-machine.ts
// (work.versions.get, work.version.get, work.compare.get) shaped for this module. It only reads; no
// version is restored or written. The fake port stays for the tests.
import {
  readTimeMachineComparison, readTimeMachineVersion, readTimeMachineVersions, type TimeMachineBlock,
} from "../../../../../../src/client/time-machine.ts";
import { createApi } from "../../../../../../src/client/api.ts";
import type { CompareBlock, TimeMachinePort } from "./model";

type Call = ReturnType<typeof createApi>;

const OP = { unchanged: "same", removed: "removed", added: "added" } as const;

/** A server block becomes one block of words that all carry the block's change. */
export function compareBlock(block: TimeMachineBlock): CompareBlock {
  const op = OP[block.change];
  return { op, words: block.text.split(/\s+/).filter(Boolean).map((text) => ({ op, text })) };
}

export function clientTimeMachinePort(call: Call = createApi()): TimeMachinePort {
  return {
    versions: (documentId) => readTimeMachineVersions(documentId, call),
    version: (documentId, revision) => readTimeMachineVersion(documentId, revision, call),
    async compare(documentId, from, to) {
      const read = await readTimeMachineComparison(documentId, from, to, call);
      return read.kind === "ready" ? { kind: "ready", blocks: read.blocks.map(compareBlock) } : read;
    },
  };
}
