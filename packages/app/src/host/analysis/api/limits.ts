import type { ApiResult } from "@/client/api";

type CatalogueBody = Extract<ApiResult<"analysis.catalogue.get">, { ok: true }>["body"];

/**
 * Limits of a data set the server takes (analysis.catalogue.get, `limits`). The contract fixes the values as literal
 * types, so a change on the server breaks this file at compile time instead of drifting silently. Other analysis
 * tasks (loading, choosing) read the limits from here and never write the numbers again.
 */
export const ANALYSIS_LIMITS = {
  maxRows: 500,
  maxColumns: 12,
  maxCellLength: 64,
  maxBodyBytes: 131072,
} as const satisfies CatalogueBody["limits"];

/** Longest column name the request body takes (contract: 1 to 40 characters). */
export const MAX_COLUMN_NAME_LENGTH = 40;
