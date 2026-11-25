import { ANALYSIS_LIMITS, MAX_COLUMN_NAME_LENGTH } from "../api/limits";
import { datasetMessages as t } from "./messages.hr";
import type { DatasetError } from "./parse-csv";

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));

/** One error as Croatian text with its place (row, column) first; the interface never shows the English code. */
export function describeError(error: DatasetError): string {
  const message = fill(t.errors[error.code], {
    name: error.name ?? "",
    max:
      error.code === "nameTooLong" ? MAX_COLUMN_NAME_LENGTH
      : error.code === "tooManyColumns" ? ANALYSIS_LIMITS.maxColumns
      : error.code === "tooManyRows" ? ANALYSIS_LIMITS.maxRows
      : error.code === "cellTooLong" ? ANALYSIS_LIMITS.maxCellLength
      : ANALYSIS_LIMITS.maxBodyBytes,
  });
  const { row, column } = error;
  if (row !== undefined && row > 0 && column !== undefined) return `${fill(t.where.cell, { row, column })}: ${message}`;
  if (row !== undefined && row > 0) return `${fill(t.where.row, { row })}: ${message}`;
  if (column !== undefined) return `${fill(t.where.column, { column })}: ${message}`;
  return message;
}
