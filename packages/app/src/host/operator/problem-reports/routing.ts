import { problemReportsMessages as t } from "./messages.hr";

/** The categories of support.problem-reports.post, in the order the student's form offers them. */
export const CATEGORIES = ["technical", "course", "account"] as const;
export type ReportCategory = (typeof CATEGORIES)[number];
/** Who reads the page: the operator's account, or the faculty's administrator. */
export type Viewer = "operator" | "admin";
export type RoutingRow = { readonly category: ReportCategory; readonly label: string; readonly handler: string; readonly yours: boolean };

const OWNER: Readonly<Record<Viewer, string>> = {
  operator: t.categories.technical.handler,
  admin: t.categories.account.handler,
};

/**
 * Who handles which report (Daniel 23. 11. 2026., t. 8): a technical problem the operator, a course
 * or assignment the teacher, an account or role the faculty's administrator. The viewer's own
 * category is marked, so each reader sees at once which reports are theirs.
 */
export function routingFor(viewer: Viewer): readonly RoutingRow[] {
  return CATEGORIES.map((category) => {
    const { label, handler } = t.categories[category];
    return { category, label, handler, yours: handler === OWNER[viewer] };
  });
}

/** The page's viewer: the administrator by the shell role, everyone else who may open it is the operator. */
export const viewerOf = (role: string | null): Viewer => (role === "admin" ? "admin" : "operator");
