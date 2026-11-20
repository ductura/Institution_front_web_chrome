export type CitationStyle = {
  faculty: string;
  style: "author-date" | "numeric";
  version: string;
  /** Present exactly when `style` is "numeric": numbers by first citation. */
  numeric?: {
    open: string;
    close: string;
    /** In the list: `[1]` ("bracket") or `1.` ("dot"). */
    listMarker: "bracket" | "dot";
    pageLabel: string;
    pageSeparator: string;
  };
  inText: {
    open: string;
    close: string;
    authorYearSeparator: string;
    pageSeparator: string;
    twoAuthorsJoiner: string;
    maxNamedAuthors: number;
    manyAuthorsSuffix: string;
  };
  bibliography: {
    authorJoiner: string;
    periodAfterYear: boolean;
    editorLabel: string;
    inLabel: string;
    accessedLabel: string;
  };
  rangeDash: string;
};

export class CitationStyleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CitationStyleError";
  }
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new CitationStyleError(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function str(obj: Record<string, unknown>, key: string, path: string): string {
  const value = obj[key];
  if (typeof value !== "string" || value === "") {
    throw new CitationStyleError(`${path}.${key} must be a non-empty string`);
  }
  return value;
}

/**
 * Validates a faculty citation config. A missing or malformed field fails
 * closed: no citation is formatted with a partial style.
 */
export function parseCitationStyle(input: unknown): CitationStyle {
  const root = record(input, "style");
  const style = str(root, "style", "style");
  if (style !== "author-date" && style !== "numeric") {
    throw new CitationStyleError(`unsupported style "${style}"`);
  }
  const inText = record(root.inText, "style.inText");
  const bib = record(root.bibliography, "style.bibliography");
  const maxNamedAuthors = inText.maxNamedAuthors;
  if (typeof maxNamedAuthors !== "number" || !Number.isInteger(maxNamedAuthors) || maxNamedAuthors < 1) {
    throw new CitationStyleError("style.inText.maxNamedAuthors must be a positive integer");
  }
  if (typeof bib.periodAfterYear !== "boolean") {
    throw new CitationStyleError("style.bibliography.periodAfterYear must be a boolean");
  }
  let numeric: CitationStyle["numeric"];
  if (style === "numeric") {
    const n = record(root.numeric, "style.numeric");
    const listMarker = n.listMarker;
    if (listMarker !== "bracket" && listMarker !== "dot") {
      throw new CitationStyleError('style.numeric.listMarker must be "bracket" or "dot"');
    }
    numeric = {
      open: str(n, "open", "style.numeric"),
      close: str(n, "close", "style.numeric"),
      listMarker,
      pageLabel: str(n, "pageLabel", "style.numeric"),
      pageSeparator: str(n, "pageSeparator", "style.numeric"),
    };
  }
  return {
    faculty: str(root, "faculty", "style"),
    style,
    ...(numeric === undefined ? {} : { numeric }),
    version: str(root, "version", "style"),
    inText: {
      open: str(inText, "open", "style.inText"),
      close: str(inText, "close", "style.inText"),
      authorYearSeparator: str(inText, "authorYearSeparator", "style.inText"),
      pageSeparator: str(inText, "pageSeparator", "style.inText"),
      twoAuthorsJoiner: str(inText, "twoAuthorsJoiner", "style.inText"),
      maxNamedAuthors,
      manyAuthorsSuffix: str(inText, "manyAuthorsSuffix", "style.inText"),
    },
    bibliography: {
      authorJoiner: str(bib, "authorJoiner", "style.bibliography"),
      periodAfterYear: bib.periodAfterYear,
      editorLabel: str(bib, "editorLabel", "style.bibliography"),
      inLabel: str(bib, "inLabel", "style.bibliography"),
      accessedLabel: str(bib, "accessedLabel", "style.bibliography"),
    },
    rangeDash: str(root, "rangeDash", "style"),
  };
}
