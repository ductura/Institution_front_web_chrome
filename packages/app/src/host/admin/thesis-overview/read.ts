import { createApi, type ApiOptions } from "@/client/api";

import { parsePage, queryOf, type Page, type StageFilter } from "./model";

const READ = "institution.thesis-overview.get";

export type OverviewRead = { kind: "ready"; page: Page } | { kind: "signedOut" | "denied" | "unavailable" };

/** One page of the list; `after` is the server's opaque cursor of the last row shown (null for the first page). */
export async function readOverview(filter: StageFilter, after: string | null, options?: ApiOptions): Promise<OverviewRead> {
  try {
    const answer = await createApi(options)(READ, { params: undefined, query: queryOf(filter, after), body: undefined });
    if (answer.ok) {
      const page = parsePage(answer.body);
      return page === null ? { kind: "unavailable" } : { kind: "ready", page };
    }
    if (answer.status === 401) return { kind: "signedOut" };
    if (answer.status === 403) return { kind: "denied" };
  } catch {
    return { kind: "unavailable" };
  }
  return { kind: "unavailable" };
}
