// The suggestion route is not in the contract extract yet (PITANJE on Ductus#2052): until it
// is, the real transport answers nothing, so the panel shows "unavailable" and invents no data.
import type { Transport } from "@/components/editor/suggestions";

export const proposalsPort: Transport = async () => null;
