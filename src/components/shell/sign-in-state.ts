import { signInReturnTo } from "@/client/api";

import { homeHref } from "./nav";
import type { ShellAccess } from "./shell-access";

/** WEB-08 (E-1): the six states of /prijava. */
export type SignInState = "signIn" | "signedOut" | "expired" | "failed" | "unavailable" | "noRole";

/** The `stanje` query /prijava understands; anything else is the plain sign-in. */
const ASKED: Readonly<Record<string, SignInState>> = {
  odjava: "signedOut",
  istekla: "expired",
  greska: "failed",
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** True for /prijava however it is spelled, so the forward never lands back on it. */
function isSignInPage(target: string): boolean {
  return target.split(/[?#]/, 1)[0]!.toLowerCase().replace(/\/+$/, "") === "/prijava";
}

export type SignInDecision =
  | { readonly kind: "redirect"; readonly to: string }
  | { readonly kind: "show"; readonly state: SignInState; readonly returnTo: string | null };

/**
 * What /prijava does for this request: a signed-in person goes on to the
 * asked page (checked by the server's rule) or to their role's home; an
 * account without a role sees A-5; a server that did not answer is
 * "unavailable"; otherwise the state the query asks for, or the plain sign-in.
 */
export function signInDecision(access: ShellAccess, query: Readonly<Record<string, string | string[] | undefined>>): SignInDecision {
  const returnTo = signInReturnTo(first(query.returnTo));
  const onward = returnTo !== null && !isSignInPage(returnTo) ? returnTo : null;
  if (access.kind === "signedIn") return { kind: "redirect", to: onward ?? homeHref(access.role) };
  if (access.kind === "noRole") return { kind: "show", state: "noRole", returnTo: null };
  if (access.kind === "unavailable") return { kind: "show", state: "unavailable", returnTo: onward };
  const asked = first(query.stanje);
  const state = asked !== undefined && Object.hasOwn(ASKED, asked) ? ASKED[asked]! : "signIn";
  return { kind: "show", state, returnTo: onward };
}
