import type { ShellRole } from "@/components/shell/nav";
import type { ShellAccess } from "@/components/shell/shell-access";

/** What the shell of /kako-radi shows for a reader. */
export type HowItWorksShell = {
  role: ShellRole | null;
  /** The institution's name from the session, when there is one. */
  institution: string | null;
  /** Whether the reader has a session to end: "Odjava" is shown. */
  signedIn: boolean;
};

/**
 * The shell around "Kako Ductura radi" (DAN-431, J-02; WEB-13 over /api/v1).
 * The page itself is the same for everyone: it reads nothing about the reader
 * and has no state. Only the shell follows the server session read (me): no
 * session or a failed read shows no role and no navigation, never a guessed
 * one; an account without a role (A-5) sees no navigation but can sign out.
 */
export function howItWorksShell(access: ShellAccess): HowItWorksShell {
  if (access.kind === "signedIn") return { role: access.role, institution: access.institution, signedIn: true };
  return { role: null, institution: null, signedIn: access.kind === "noRole" };
}
