import { sourceFormHr as t } from "./messages.hr";

export type SourcePerson = { kind: "person"; family: string; given: string };
export type SourceAuthor = SourcePerson | { kind: "organization"; name: string; acronym?: string };

type Common = { authors: SourceAuthor[]; title: string; year: number };
type Publication = { place: string; publisher: string };
export type SourceDraft = Common & (
  | ({ type: "book" } & Publication)
  | { type: "article"; journal: string; volume?: string; issue?: string; pages?: string }
  | ({ type: "chapter"; editors: SourcePerson[]; bookTitle: string; pages?: string } & Publication)
  | { type: "web"; url: string; accessed: string }
);
export type SourceType = SourceDraft["type"];

const publication = ["place", "publisher"] as const;
export const fieldsByType = {
  book: publication,
  article: ["journal", "volume", "issue", "pages"],
  chapter: ["bookTitle", ...publication, "pages"],
  web: ["url", "accessed"],
} as const;
export const sourceTypes = Object.keys(fieldsByType) as SourceType[];
const limits = {
  title: 1000, bookTitle: 1000, journal: 500, publisher: 300, place: 200, family: 200, given: 200,
  name: 300, acronym: 50, volume: 50, issue: 50, pages: 50,
} as const;
const forbidden = /[\p{Cc}\p{Cs}\u00ad\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u206f\ufeff]/u;
const optionalFields = new Set(["acronym", "volume", "issue", "pages"]);
export const isRequired = (field: string) => !optionalFields.has(field);

export function readSource(type: SourceType, data: FormData) {
  const errors: Record<string, string> = {};
  const value = (name: string) => String(data.get(name) ?? "").trim();
  const text = (field: keyof typeof limits, name: string = field) => {
    const input = value(name);
    if (!input && isRequired(field)) errors[name] = t.required;
    else if (forbidden.test(input) || [...input].length > limits[field]) errors[name] = t.invalidText;
    return input;
  };
  const person = (prefix: string): SourcePerson => ({
    kind: "person", family: text("family", `${prefix}.family`), given: text("given", `${prefix}.given`),
  });
  const authors: SourceAuthor[] = [];
  for (let i = 0; data.has(`authors.${i}.kind`); i += 1) {
    const prefix = `authors.${i}`;
    if (value(`${prefix}.kind`) === "organization") {
      const name = text("name", `${prefix}.name`);
      const acronym = text("acronym", `${prefix}.acronym`);
      authors.push({ kind: "organization", name, ...(acronym && { acronym }) });
    } else authors.push(person(prefix));
  }

  const year = value("year");
  if (!/^[1-9]\d{3}$/.test(year)) errors.year = year ? t.invalidYear : t.required;
  const common = { authors, title: text("title"), year: Number(year) };
  const publication = () => ({ place: text("place"), publisher: text("publisher") });
  const optional = (field: "volume" | "issue" | "pages") => {
    const input = text(field);
    return input ? { [field]: input } : {};
  };

  let draft: SourceDraft;
  switch (type) {
    case "book":
      draft = { ...common, type, ...publication() };
      break;
    case "article":
      draft = { ...common, type, journal: text("journal"), ...optional("volume"), ...optional("issue"), ...optional("pages") };
      break;
    case "chapter": {
      const editors: SourcePerson[] = [];
      for (let i = 0; data.has(`editors.${i}.family`); i += 1) editors.push(person(`editors.${i}`));
      draft = { ...common, type, editors, bookTitle: text("bookTitle"), ...publication(), ...optional("pages") };
      break;
    }
    case "web": {
      const url = value("url");
      const accessed = value("accessed");
      if (!/^https?:\/\/[\x21-\x7e]+$/.test(url) || url.length > 2048 || !URL.canParse(url)) {
        errors.url = url ? t.invalidUrl : t.required;
      }
      const date = new Date(`${accessed}T00:00:00Z`);
      if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(accessed) || !Number.isFinite(+date) || date.toISOString().slice(0, 10) !== accessed) {
        errors.accessed = accessed ? t.invalidDate : t.required;
      }
      draft = { ...common, type, url, accessed };
      break;
    }
  }
  return Object.keys(errors).length ? { errors } : { draft };
}
