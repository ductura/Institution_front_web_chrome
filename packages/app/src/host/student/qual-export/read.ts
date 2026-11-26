// WEB-V18-KODIRANJE-IZVOZ: the reads of the export, through the contract only (student.qual-export.get, and
// student.qual-materials.get for the choice of one material). Another student's material reads as an unknown
// one (404). A refusal is never an empty export: "not found", "signed out" and "unavailable" are states of
// their own.
import type { createApi } from "@/client/api";
import type { QualExport } from "./model";

type Api = ReturnType<typeof createApi>;

export type MaterialChoice = { readonly id: string; readonly title: string };
export type ExportRead =
  | { readonly kind: "ok"; readonly data: QualExport }
  | { readonly kind: "notFound" }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };
export type MaterialsRead =
  | { readonly kind: "ok"; readonly materials: readonly MaterialChoice[] }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

const SIGNED_OUT: ReadonlySet<string> = new Set(["unauthorized", "session_expired"]);
const signedOut = (r: { readonly code: string }) => SIGNED_OUT.has(r.code);

/** The client rejects when the connection drops or the body cannot be read. */
async function attempt<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch {
    return null;
  }
}

/** `materialId` is the one material to export, or null for all of them. */
export async function readExport(call: Api, materialId: string | null): Promise<ExportRead> {
  const query = materialId === null ? {} : { materialId };
  const r = await attempt(() => call("student.qual-export.get", { params: undefined, query, body: undefined }));
  if (r === null) return { kind: "unavailable" };
  if (!r.ok) {
    if (signedOut(r)) return { kind: "signedOut" };
    return r.status === 404 || r.code === "not_found" ? { kind: "notFound" } : { kind: "unavailable" };
  }
  return { kind: "ok", data: r.body };
}

export async function readMaterialChoices(call: Api): Promise<MaterialsRead> {
  const r = await attempt(() => call("student.qual-materials.get", { params: undefined, query: undefined, body: undefined }));
  if (r === null) return { kind: "unavailable" };
  if (!r.ok) return signedOut(r) ? { kind: "signedOut" } : { kind: "unavailable" };
  return { kind: "ok", materials: r.body.materials.map((m) => ({ id: m.id, title: m.title })) };
}
