// ED-20 (NF2-P19, WEB-1801): the student brings in an existing DOCX or PDF.
// The file goes to the server (`work.imports.post`), the server answers a
// preview, and the text enters the work only after the student confirms it
// (`work.imports.confirm.post` with the preview's manifest). Nothing here reads
// the file's text in the browser; the file is only encoded for the request.
// Both calls go through createApi with the generated contract, so an answer
// of an unknown shape is "unavailable", never a partial preview.
import { createApi } from "./api";

export type ImportFormat = "docx" | "pdf";
/** The contract's ceiling: 2 MB of file is 2 796 204 characters of base64. */
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;

type Mark = "bold" | "italic";
export type ImportText = { type: "text"; text: string; marks: Mark[] };
/** One block of the previewed text, as the canonical document (schema 2) names it. */
export type ImportBlock =
  | { type: "paragraph" | "bulletItem" | "quote"; children: ImportText[] }
  | { type: "heading"; level: 1 | 2 | 3; children: ImportText[] };

export type ImportPreview = {
  importId: string;
  manifestSha256: string;
  format: ImportFormat;
  fileName: string | null;
  blocks: ImportBlock[];
  words: number;
  expiresAt: string;
};
export type ImportRefusalReason = "type" | "tooLarge" | "empty" | "unreadable" | "noTextLayer";

export type PreviewResult =
  | { kind: "preview"; preview: ImportPreview }
  | { kind: "refused"; reason: ImportRefusalReason }
  | { kind: "notAllowed" | "signedOut" | "unavailable" };

export type ConfirmResult =
  | { kind: "confirmed"; eventId: string }
  | { kind: "notAllowed" | "signedOut" | "expired" | "changed" | "unavailable" };

type Api = ReturnType<typeof createApi>;

export function importFormatOf(file: { name: string }): ImportFormat | null {
  const extension = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase();
  return extension === "docx" || extension === "pdf" ? extension : null;
}

export const blockText = (block: ImportBlock) => block.children.map((child) => child.text).join("");

export const countWords = (blocks: readonly ImportBlock[]) =>
  blocks.reduce((sum, block) => sum + (blockText(block).match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0), 0);

/** The file as base64, in chunks so a 2 MB file does not overflow the argument list. */
export async function fileBase64(file: Blob): Promise<string> {
  const buffer = typeof file.arrayBuffer === "function" ? await file.arrayBuffer() : await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  return btoa(binary);
}

export async function previewImport(documentId: string, file: File, api: Api = createApi()): Promise<PreviewResult> {
  const format = importFormatOf(file);
  if (!format) return { kind: "refused", reason: "type" };
  if (file.size === 0) return { kind: "refused", reason: "empty" };
  if (file.size > IMPORT_MAX_BYTES) return { kind: "refused", reason: "tooLarge" };
  try {
    const result = await api("work.imports.post", {
      params: { documentId }, query: undefined, body: { fileBase64: await fileBase64(file), fileName: file.name.slice(0, 1024) },
    });
    if (!result.ok) {
      if (result.status === 401) return { kind: "signedOut" };
      if (result.code === "import_not_allowed") return { kind: "notAllowed" };
      if (result.code === "body_too_large") return { kind: "refused", reason: "tooLarge" };
      if (result.code === "unsupported_media_type") return { kind: "refused", reason: "type" };
      if (result.code === "pdf_no_text_layer") return { kind: "refused", reason: "noTextLayer" };
      if (result.code === "invalid_document") return { kind: "refused", reason: "unreadable" };
      return { kind: "unavailable" };
    }
    const body = result.body;
    if (body.fileFormat !== format) return { kind: "unavailable" };
    const blocks: ImportBlock[] = body.content.nodes.map((node): ImportBlock => {
      const children = node.children.map(({ text, marks }) => ({ type: "text" as const, text, marks: [...marks] }));
      return node.type === "heading" ? { type: "heading", level: node.level, children } : { type: node.type, children };
    }).filter((block) => blockText(block).trim() !== "");
    if (blocks.length === 0) return { kind: "refused", reason: "empty" };
    return {
      kind: "preview",
      preview: {
        importId: body.importId, manifestSha256: body.manifestSha256, format, fileName: body.fileName,
        blocks, words: countWords(blocks), expiresAt: body.expiresAt,
      },
    };
  } catch {
    return { kind: "unavailable" };
  }
}

/** Idempotent on the server: confirming the same preview again returns the same event. */
export async function confirmImport(documentId: string, preview: ImportPreview, api: Api = createApi()): Promise<ConfirmResult> {
  try {
    const result = await api("work.imports.confirm.post", {
      params: { documentId, importId: preview.importId }, query: undefined,
      body: { importId: preview.importId, manifestSha256: preview.manifestSha256 },
    });
    if (!result.ok) {
      if (result.status === 401) return { kind: "signedOut" };
      if (result.code === "import_not_allowed") return { kind: "notAllowed" };
      if (result.code === "import_expired" || result.code === "import_not_found") return { kind: "expired" };
      if (result.code === "import_revision_changed") return { kind: "changed" };
      return { kind: "unavailable" };
    }
    if (result.body.importId !== preview.importId) return { kind: "unavailable" };
    return { kind: "confirmed", eventId: result.body.eventId };
  } catch {
    return { kind: "unavailable" };
  }
}
