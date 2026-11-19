import { PendingPage } from "../../../src/host/pages";

/**
 * Every path under the base without a route of its own: the host leads "/"
 * to the role's home and shows "Stranica ne postoji" in the shell for a path
 * no page has (src/routes.ts PAGES); a page of PAGES without a route of its
 * own would show its heading and the pending note.
 */
export default function Page() {
  return <PendingPage />;
}
