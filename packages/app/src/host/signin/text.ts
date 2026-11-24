// P-15 (NF-1, E-1a): the texts of /prijava that the shared catalogues do not carry.
// Kept beside the screen: the catalogue sections are other lanes'. Decision A-5:
// the coordinator is the faculty administrator, so the text names that role. The
// refused text does not claim a cause, since the login route does not give one (N-19).
import type { UiLocale } from "@ductura/ui";

export type SignInText = {
  readonly refusedTitle: string;
  readonly refusedBody: string;
  readonly refusedContact: string;
  readonly unavailableTitle: string;
  readonly noRoleWho: string;
  readonly noRoleContact: string;
  readonly helpAccessBody: string;
};

const hr: SignInText = {
  refusedTitle: "Prijava je odbijena",
  refusedBody: "Vaš račun AAI@EduHr nema pristup ovom prostoru. To nije kvar prijave i ponovni pokušaj ga neće promijeniti.",
  refusedContact: "Javite se koordinatoru (administratoru fakulteta) na svojoj ustanovi.",
  unavailableTitle: "AAI@EduHr trenutačno ne odgovara",
  noRoleWho: "Ulogu dodjeljuje administrator fakulteta.",
  noRoleContact: "Javite se koordinatoru (administratoru fakulteta) na svojoj ustanovi.",
  helpAccessBody: "Javite se koordinatoru (administratoru fakulteta) na svojoj ustanovi.",
};

const en: SignInText = {
  refusedTitle: "Sign-in refused",
  refusedBody: "Your AAI@EduHr account has no access to this space. This is not a sign-in fault and trying again will not change it.",
  refusedContact: "Contact the coordinator (the faculty administrator) at your institution.",
  unavailableTitle: "AAI@EduHr is not responding right now",
  noRoleWho: "Roles are assigned by the faculty administrator.",
  noRoleContact: "Contact the coordinator (the faculty administrator) at your institution.",
  helpAccessBody: "Contact the coordinator (the faculty administrator) at your institution.",
};

export const signInText = { hr, en } as const;

/** The table of the interface language; Croatian for any other. */
export function signInTextFor(locale: UiLocale | string): SignInText {
  return locale === "en" ? en : hr;
}
