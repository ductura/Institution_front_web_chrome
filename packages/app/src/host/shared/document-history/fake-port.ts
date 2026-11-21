// In-memory stand-in for the import-history route (WEB-1802); invented data only.
import type { DocumentHistoryPort, HistoryRead, ImportRecord } from "./model";

export const FAKE_IMPORTS: readonly ImportRecord[] = [
  {
    id: "imp-1",
    importedAt: "2026-11-10T09:30:00Z",
    source: "docx",
    claims: { fileName: "primjer-seminar.docx", creator: "Izmišljena Osoba", createdAt: "2026-11-01T08:00:00Z", modifiedAt: "2026-11-09T20:15:00Z", revisions: 12 },
  },
  { id: "imp-2", importedAt: "2026-11-12T14:05:00Z", source: "pdf", claims: { fileName: "primjer-izvor.pdf" } },
];

export function fakeDocumentHistoryPort(answer: HistoryRead = { kind: "ready", imports: FAKE_IMPORTS }): DocumentHistoryPort {
  return { read: async () => answer };
}
