/** Largest text accepted by one import; the file is read locally and never uploaded. */
export const IMPORT_MAX_CHARS = 200_000;

export type ImportRefusal = "empty" | "needDeclaration" | "tooLarge" | "badFile";

export type TextImport = {
  paragraphs: string[];
  words: number;
  /** ISO time of the import, taken by the caller's clock. */
  importedAt: string;
  declared: true;
};

export const isTextFile = (file: { name: string; type?: string }) =>
  /\.(txt|md)$/i.test(file.name) && (file.type === undefined || file.type === "" || file.type.startsWith("text/"));

/** Paragraphs are separated by blank lines; single line breaks inside one stay as spaces. */
export function splitParagraphs(raw: string): string[] {
  return raw.replace(/\r\n?/g, "\n").replace(/\u0000/g, "").split(/\n[ \t]*\n+/)
    .map((block) => block.split("\n").map((line) => line.trim()).filter(Boolean).join(" ")).filter(Boolean);
}

export const countWords = (paragraphs: readonly string[]) =>
  paragraphs.reduce((sum, text) => sum + (text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0), 0);

/** Validates an import. The declaration is mandatory: an import never goes in without it. */
export function prepareImport(raw: string, declared: boolean, now: Date): TextImport | ImportRefusal {
  if (raw.length > IMPORT_MAX_CHARS) return "tooLarge";
  const paragraphs = splitParagraphs(raw);
  if (paragraphs.length === 0) return "empty";
  if (!declared) return "needDeclaration";
  return { paragraphs, words: countWords(paragraphs), importedAt: now.toISOString(), declared: true };
}

export const isRefusal = (value: TextImport | ImportRefusal): value is ImportRefusal => typeof value === "string";
