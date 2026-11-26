// WEB-V21-STEM-IPYNB-UVOZ (7a): reads a Jupyter notebook (.ipynb, JSON) for display only. Pure function:
// nothing is executed, nothing is fetched, and a bad file is a refusal, never a throw.
export const IPYNB_MAX_BYTES = 1024 * 1024;
export const IPYNB_MAX_CELLS = 200;

export type IpynbOutput = { readonly outputType: string; readonly name: string | null; readonly text: string | null; readonly data: Readonly<Record<string, string>> };
export type IpynbCell = { readonly kind: "markdown" | "code"; readonly source: string; readonly outputs: readonly IpynbOutput[] };
export type Notebook = { readonly language: string | null; readonly cells: readonly IpynbCell[] };
export type IpynbRefusal = "tooLarge" | "tooManyCells" | "invalid";
export type ParseResult = { readonly kind: "ok"; readonly notebook: Notebook } | { readonly kind: "refused"; readonly reason: IpynbRefusal };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
/** nbformat stores text as a string or as an array of strings (lines). */
const multiline = (value: unknown): string | null =>
  typeof value === "string" ? value : Array.isArray(value) && value.every((line) => typeof line === "string") ? value.join("") : null;
const lower = (value: unknown) => (typeof value === "string" && value.trim() !== "" ? value.trim().toLowerCase() : null);

function readOutput(raw: unknown): IpynbOutput | null {
  if (!isRecord(raw) || typeof raw.output_type !== "string") return null;
  const data: Record<string, string> = {};
  if (isRecord(raw.data)) for (const [mime, value] of Object.entries(raw.data)) data[mime] = multiline(value) ?? "";
  return { outputType: raw.output_type, name: typeof raw.name === "string" ? raw.name : null, text: multiline(raw.text), data };
}

function readCell(raw: unknown): IpynbCell | null {
  if (!isRecord(raw)) return null;
  const source = multiline(raw.source);
  if (source === null) return null;
  if (raw.cell_type === "markdown") return { kind: "markdown", source, outputs: [] };
  if (raw.cell_type !== "code") return null;
  const rawOutputs = raw.outputs === undefined ? [] : raw.outputs;
  if (!Array.isArray(rawOutputs)) return null;
  const outputs = rawOutputs.map(readOutput);
  if (outputs.some((output) => output === null)) return null;
  return { kind: "code", source, outputs: outputs as IpynbOutput[] };
}

export function parseIpynb(text: string): ParseResult {
  if (typeof text !== "string" || new TextEncoder().encode(text).byteLength > IPYNB_MAX_BYTES) return { kind: "refused", reason: "tooLarge" };
  let json: unknown;
  try { json = JSON.parse(text); } catch { return { kind: "refused", reason: "invalid" }; }
  if (!isRecord(json) || !Array.isArray(json.cells)) return { kind: "refused", reason: "invalid" };
  if (json.cells.length > IPYNB_MAX_CELLS) return { kind: "refused", reason: "tooManyCells" };
  const cells: IpynbCell[] = [];
  for (const raw of json.cells) {
    // A raw cell carries no text we show; an unknown kind is skipped, a malformed known one refuses the file.
    if (isRecord(raw) && raw.cell_type !== "markdown" && raw.cell_type !== "code") continue;
    const cell = readCell(raw);
    if (cell === null) return { kind: "refused", reason: "invalid" };
    cells.push(cell);
  }
  const metadata = isRecord(json.metadata) ? json.metadata : {};
  const kernelspec = isRecord(metadata.kernelspec) ? metadata.kernelspec : {};
  return { kind: "ok", notebook: { language: lower(kernelspec.language) ?? lower(kernelspec.name), cells } };
}
