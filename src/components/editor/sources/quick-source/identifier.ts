export type Identifier = { kind: "doi" | "isbn"; value: string };

const DOI = /^10\.\d{4,9}\/[\x21-\x7e]+$/;
const DOI_PREFIX = /^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i;

function isbn10Valid(digits: string): boolean {
  if (!/^\d{9}[\dX]$/.test(digits)) return false;
  const sum = [...digits].reduce((acc, char, i) => acc + (char === "X" ? 10 : Number(char)) * (10 - i), 0);
  return sum % 11 === 0;
}

function isbn13Valid(digits: string): boolean {
  if (!/^\d{13}$/.test(digits)) return false;
  const sum = [...digits].reduce((acc, char, i) => acc + Number(char) * (i % 2 === 0 ? 1 : 3), 0);
  return sum % 10 === 0;
}

/** A DOI or ISBN as typed or pasted, normalised (DOI without its URL prefix, ISBN without hyphens); null when neither. */
export function parseIdentifier(input: string): Identifier | null {
  const text = input.trim();
  const doi = text.replace(DOI_PREFIX, "");
  if (DOI.test(doi) && doi.length <= 200) return { kind: "doi", value: doi };
  const isbn = text.replace(/^isbn(?:-1[03])?:?\s*/i, "").replace(/[\s-]/g, "").toUpperCase();
  if (isbn10Valid(isbn) || isbn13Valid(isbn)) return { kind: "isbn", value: isbn };
  return null;
}
