// The real port of N-11: the two reads of src/client (createApi with the generated contract).
import { readTimeMachineComparison, readTimeMachineVersions } from "../../../../../../src/client/time-machine";
import type { N11Port } from "./model";

export const n11Port: N11Port = {
  versions: (documentId) => readTimeMachineVersions(documentId),
  compare: (documentId, from, to) => readTimeMachineComparison(documentId, from, to),
};
