"use client";

// PIL-K-IZJAVA-VRATA: whether steps 3 and 4 may send, read from the server through the declaration
// client (student.declaration-second.get), never from this browser: neither its storage nor the address step 2 hands over.
// A failed read keeps sending closed (PRODUCT §5 rule 11); the server checks again on submission.
// WEB-NUZ-PREDAJA-1 (PR-2): the hook and the selector live beside the rehearsal, so the rehearsal, the
// workspace's top bar and these steps read one source; this module only names them for the steps.
export {
  beforeSubmission,
  declarationText,
  opensSending,
  serverGate,
  useDeclarationGate,
  type GateRead,
  type GateState,
} from "../../../../../../../src/components/editor/submission-rehearsal/declaration-gate.ts";
