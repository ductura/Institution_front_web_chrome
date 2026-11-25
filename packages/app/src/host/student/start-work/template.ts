// WEB-V17-TEMPLATE-START: what the student gets when a work starts under a faculty
// template (student.assignment-template.get): the title page and empty sections as
// editor-v1 blocks (headings and paragraphs only; v3 goes through PIL-K-SHEMA-V3).
// Pure: the server's answer in, blocks out. Nothing is made up when there is none.

export const TITLE_FIELDS = ["title", "author", "mentor", "course", "date"] as const;
export type TitleField = (typeof TITLE_FIELDS)[number];

export type WorkTemplate = {
  readonly version: number;
  readonly titlePage: readonly TitleField[];
  readonly sections: readonly { readonly title: string; readonly hint: string }[];
  readonly citationStyle: "fpzg";
};

export type TemplateRead =
  | { readonly kind: "ready"; readonly template: WorkTemplate }
  /** 404: no template pinned to the assignment, or not this student's; both read the same. */
  | { readonly kind: "none" }
  /** Loading failed: said as such, never as "no template". */
  | { readonly kind: "unavailable" };

export type Block = {
  readonly type: "heading" | "paragraph";
  readonly attrs?: { readonly level: number };
  readonly content?: readonly { readonly type: "text"; readonly text: string }[];
};

const MAX_SECTIONS = 30;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** The server's body as a template, or null when its shape is not the contract's. */
export function parseTemplate(body: unknown): WorkTemplate | null {
  if (!isRecord(body) || !Number.isInteger(body.version) || (body.version as number) < 1) return null;
  if (body.citationStyle !== "fpzg" || !Array.isArray(body.titlePage) || !Array.isArray(body.sections)) return null;
  if (body.sections.length > MAX_SECTIONS) return null;
  const titlePage = body.titlePage;
  if (!titlePage.every((f): f is TitleField => (TITLE_FIELDS as readonly unknown[]).includes(f))) return null;
  const sections: { title: string; hint: string }[] = [];
  for (const s of body.sections) {
    if (!isRecord(s) || typeof s.title !== "string" || typeof s.hint !== "string" || s.title.trim() === "") return null;
    sections.push({ title: s.title, hint: s.hint });
  }
  return { version: body.version as number, titlePage, sections, citationStyle: "fpzg" };
}

const text = (value: string): Block["content"] => (value === "" ? undefined : [{ type: "text", text: value }]);

/**
 * Title-page lines (the label alone, the student fills the value in) and one heading
 * plus one paragraph holding the hint for each section. Hints are guidance, so they
 * are paragraphs the student overwrites; an empty hint leaves an empty paragraph.
 */
export function templateBlocks(template: WorkTemplate, labels: Readonly<Record<TitleField, string>>): readonly Block[] {
  const page: Block[] = template.titlePage.map((f) => ({ type: "paragraph", content: text(`${labels[f]}: `) }));
  const sections = template.sections.flatMap((s): Block[] => [
    { type: "heading", attrs: { level: 1 }, content: text(s.title) },
    { type: "paragraph", content: text(s.hint) },
  ]);
  return [...page, ...sections];
}
