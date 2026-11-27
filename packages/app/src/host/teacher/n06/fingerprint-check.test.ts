// Otisak verzije: izračun iz JCS bajtova prikazanog dokumenta i usporedba sa zabilježenim. Samo izmišljeni tekst.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import type { LiveDocument } from "@/client/live-publisher";
import { jcsUtf8Bytes } from "@/domain/forensics/jcs";
import { checkFingerprint, fingerprintLabel, sha256Hex } from "./fingerprint-check";

const DOC = { schemaVersion: 1, nodes: [{ id: "p1", type: "paragraph", text: "Izmišljeni ulomak o lokalnim medijima." }] } as unknown as LiveDocument;
const recordedOf = (doc: unknown): string => createHash("sha256").update(jcsUtf8Bytes(doc)).digest("hex");

describe("otisak verzije", () => {
  it("računa SHA-256 kao Node za iste bajtove", async () => {
    const bytes = new TextEncoder().encode("abc");
    expect(await sha256Hex(bytes)).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("podudara se kad je prikazani dokument zabilježena verzija", async () => {
    const recorded = recordedOf(DOC);
    expect(await checkFingerprint(DOC, { sha256: recorded, revision: 9 }))
      .toEqual({ kind: "match", revision: 9, recorded, shown: recorded });
  });

  it("ne podudara se kad se promijeni jedno slovo", async () => {
    const changed = { ...DOC, nodes: [{ id: "p1", type: "paragraph", text: "Izmišljeni ulomak o lokalnim medijama." }] } as unknown as LiveDocument;
    const state = await checkFingerprint(changed, { sha256: recordedOf(DOC), revision: 9 });
    expect(state.kind).toBe("mismatch");
  });

  it("bez Web Crypta, s neispravnim zabilježenim otiskom ili dokumentom nikad ne kaže da se podudara", async () => {
    const recorded = recordedOf(DOC);
    expect(await checkFingerprint(DOC, { sha256: recorded, revision: 9 }, null)).toEqual({ kind: "unavailable" });
    expect(await checkFingerprint(DOC, { sha256: recorded.toUpperCase(), revision: 9 })).toEqual({ kind: "unavailable" });
    expect(await checkFingerprint(DOC, { sha256: recorded, revision: Number.NaN })).toEqual({ kind: "unavailable" });
    expect(await checkFingerprint({ x: undefined } as unknown as LiveDocument, { sha256: recorded, revision: 1 })).toEqual({ kind: "unavailable" });
  });

  it("oznaka ne ispisuje SHA; puni SHA-256 je samo u opisu", () => {
    const sha = "b".repeat(64);
    const ok = fingerprintLabel({ kind: "match", revision: 9, recorded: sha, shown: sha });
    expect(ok.label).toBe("Otisak se podudara");
    expect(ok.small).toBe("verzija 9");
    expect(ok.label + ok.small).not.toContain(sha);
    expect(ok.title).toContain(`SHA-256 zabilježene verzije 9: ${sha}`);
    expect(fingerprintLabel({ kind: "mismatch", revision: 9, recorded: sha, shown: "c".repeat(64) }).label).toBe("Otisak se ne podudara");
    expect(fingerprintLabel({ kind: "checking" })).toEqual({ label: "Provjeravam otisak…", small: null, title: "Provjeravam otisak…" });
  });
});
