// Pure rules of "Izvoz za portfelj" (WEB-1807; plan M10.11, S-10). Only submitted versions are offered; a
// course that has ended changes nothing while the retention lasts. No server route is called here: the list
// comes through the port, the PDF and the package through the routes the app already has (WEB-1803, WEB-1304).
export type PortfolioEntry = {
  readonly submissionId: string;
  /** The assignment the work belongs to: work.export-pdf.get names the work under it (WEB-2005). */
  readonly assignmentId: string;
  readonly documentId: string;
  readonly versionId: string;
  readonly title: string;
  readonly submittedAt: string;
  readonly courseEnded: boolean;
};

/** What the port may hand over: anything not submitted is dropped by the rules below. */
export type PortfolioRaw = PortfolioEntry & { readonly status: string };

export type PortfolioRead =
  | { readonly kind: "ok"; readonly entries: readonly PortfolioRaw[] }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

export interface PortfolioPort {
  read(): Promise<PortfolioRead>;
}

export type PortfolioView =
  | { readonly kind: "ready"; readonly entries: readonly PortfolioEntry[] }
  | { readonly kind: "empty" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Only submitted versions with well-formed ids, newest first (ISO times compare as text). */
export function portfolioView(read: PortfolioRead): PortfolioView {
  if (read.kind !== "ok") return { kind: read.kind };
  const entries = read.entries
    .filter((e) => e.status === "submitted" && UUID.test(e.submissionId) && UUID.test(e.assignmentId) && UUID.test(e.documentId) && UUID.test(e.versionId))
    .map(({ status: _status, ...entry }) => entry)
    .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : a.submittedAt > b.submittedAt ? -1 : 0));
  return entries.length === 0 ? { kind: "empty" } : { kind: "ready", entries };
}

/** Reads through the port; a failure is "unavailable", never a made-up list. */
export async function loadPortfolio(port: PortfolioPort): Promise<PortfolioView> {
  try {
    return portfolioView(await port.read());
  } catch {
    return { kind: "unavailable" };
  }
}

/** The date of a submission in the Zagreb calendar, dd. mm. yyyy. */
export function submittedDate(iso: string): string {
  const parts = new Intl.DateTimeFormat("hr-HR", { timeZone: "Europe/Zagreb", day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}. ${get("month")}. ${get("year")}.`;
}
