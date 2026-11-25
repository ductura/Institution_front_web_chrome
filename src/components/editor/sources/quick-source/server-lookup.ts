// ED-14 (NF2-P7, P2-10a): the quick source's lookup over the server, `sources.lookup.post`. Only the identifier
// (a DOI or an ISBN) leaves the browser, never the text of the work. The server's record becomes a draft of
// the source form, which the student always checks before saving.
import type { SourceAuthor, SourceDraft } from "@ductura/ui";

import { createApi } from "@/client/api";

import { LookupInvalid, LookupOffline, LookupUnavailable, type SourceLookup } from "./lookup";

type Call = ReturnType<typeof createApi>;

/** The source record as the contract answers it (`sources.lookup.post` 200, `source` when not null). */
export type LookedUpSource = {
  readonly type: "book" | "chapter" | "article" | null;
  readonly title: string;
  readonly authors: readonly { readonly name: string; readonly family?: string; readonly given?: string }[];
  readonly year?: number;
  readonly journal?: string;
  readonly bookTitle?: string;
  readonly publisher?: string;
  readonly place?: string;
  readonly volume?: string;
  readonly issue?: string;
  readonly pages?: string;
};

/** A person's name as the catalogue gives it: "Prezime, Ime", or "Ime Prezime" when there is no comma. */
function personOf(author: LookedUpSource["authors"][number]): SourceAuthor {
  if (author.family !== undefined) return { kind: "person", family: author.family, given: author.given ?? "" };
  const name = author.name.trim();
  const comma = name.indexOf(",");
  if (comma > 0) return { kind: "person", family: name.slice(0, comma).trim(), given: name.slice(comma + 1).trim() };
  const space = name.lastIndexOf(" ");
  return space > 0
    ? { kind: "person", family: name.slice(space + 1), given: name.slice(0, space) }
    : { kind: "person", family: name, given: "" };
}

/**
 * The server's record as a draft of the source form. A field the catalogue does not know stays empty, so the
 * form asks for it; an unknown type opens as a book, which the student can change.
 */
export function draftOf(source: LookedUpSource): SourceDraft {
  // The year is required by the form; without one it stays empty and the form asks for it.
  const common = { authors: source.authors.map(personOf), title: source.title, year: source.year as number };
  const optional = (key: "volume" | "issue" | "pages") => (source[key] === undefined ? {} : { [key]: source[key] });
  if (source.type === "article") {
    return { ...common, type: "article", journal: source.journal ?? "", ...optional("volume"), ...optional("issue"), ...optional("pages") };
  }
  const publication = { place: source.place ?? "", publisher: source.publisher ?? "" };
  if (source.type === "chapter") {
    return { ...common, type: "chapter", editors: [], bookTitle: source.bookTitle ?? "", ...publication, ...optional("pages") };
  }
  return { ...common, type: "book", ...publication };
}

/** The real lookup: 200 with a record or null; 422 is an identifier the server does not take; 503 is unavailable. */
export function createSourceLookup(call: Call = createApi()): SourceLookup {
  return async (identifier) => {
    let result: Awaited<ReturnType<Call>>;
    try {
      result = await call("sources.lookup.post", { params: undefined, query: undefined, body: { kind: identifier.kind, identifier: identifier.value } });
    } catch (error) {
      // The call rejects only when the request does not reach the server.
      throw new LookupOffline(error instanceof Error ? error.message : "network");
    }
    if (!result.ok) {
      if (result.status === 422) throw new LookupInvalid(result.code);
      if (result.status === 503 || result.status === 408) throw new LookupUnavailable(result.code);
      throw new Error(result.code);
    }
    const source = result.body.source as LookedUpSource | null;
    return source === null ? { status: "not_found" } : { status: "found", draft: draftOf(source) };
  };
}
