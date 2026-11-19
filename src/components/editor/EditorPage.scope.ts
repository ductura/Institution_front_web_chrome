// WEB-14b: the local journal's scope for one work. INTERIM (Ductus#2028
// c.7020997158): /api/v1 names no person scope yet, so the journal is kept
// per work, from the documentId evidence.open.post gave. Another student on
// the same device has another work, so never opens this journal.

const LABEL = "ductura-journal-scope-v1\n";

/** The 64-character lower-case SHA-256 hex `AtomicDexieJournal` requires. */
export async function journalScopeOf(documentId: string, subtle: SubtleCrypto = globalThis.crypto.subtle): Promise<string> {
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(LABEL + documentId));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
