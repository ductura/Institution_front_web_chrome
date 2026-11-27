// Otisak verzije (odluka vlasnika proizvoda 25. 11. 2026., koncepti/naslovnica/ODLUKE.md): nastavnik vidi
// podudara li se tekst na zaslonu sa zabilježenom verzijom. Bez mrežnog poziva.
//
// Što se uspoređuje, iz onoga što poslužitelj danas daje:
// - zabilježeni otisak je `artifactSha256` iz potpisane potvrde o predaji (teacher.submission-receipt.get),
//   SHA-256 kanonskog (RFC 8785 JCS) dokumenta predane verzije, s njezinim brojem `revision`;
// - otisak prikazanog teksta računa se ovdje, Web Cryptom, iz JCS bajtova dokumenta koji je na zaslonu.
// Ugovor ne daje otisak za ostale verzije (work.versions.get vraća samo vrstu, broj i minutu), pa se
// otisak može provjeriti samo za predanu verziju; za svaku verziju trebao bi ga poslati poslužitelj.
import type { LiveDocument } from "@/client/live-publisher";
import { jcsUtf8Bytes } from "@/domain/forensics/jcs";

import { workFrameMessages } from "./messages.hr";

const text = workFrameMessages.fingerprint;

/** Otisak i broj verzije kako ih je zabilježio poslužitelj. */
export type RecordedFingerprint = { readonly sha256: string; readonly revision: number };

export type FingerprintState =
  | { readonly kind: "checking" }
  | { readonly kind: "unavailable" }
  | { readonly kind: "match" | "mismatch"; readonly revision: number; readonly recorded: string; readonly shown: string };

const HEX = /^[0-9a-f]{64}$/;

/** Web Crypto preglednika; null izvan sigurnog konteksta (npr. http na adresi koja nije localhost). */
const defaultSubtle = (): SubtleCrypto | null => globalThis.crypto?.subtle ?? null;

/** SHA-256 bajtova kao 64 mala heksadecimalna znaka; null bez Web Crypta ili kad izračun ne uspije. */
export async function sha256Hex(bytes: Uint8Array, subtle: SubtleCrypto | null = defaultSubtle()): Promise<string | null> {
  if (subtle === null) return null;
  try {
    const digest = new Uint8Array(await subtle.digest("SHA-256", new Uint8Array(bytes)));
    return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

/**
 * Računa otisak prikazanog dokumenta i uspoređuje ga sa zabilježenim. Zabilježeni otisak koji nije
 * SHA-256 ili dokument koji se ne da kanonski zapisati daju „nije moguće provjeriti”, nikad „podudara se”.
 */
export async function checkFingerprint(
  document: LiveDocument, recorded: RecordedFingerprint, subtle: SubtleCrypto | null = defaultSubtle(),
): Promise<FingerprintState> {
  if (!HEX.test(recorded.sha256) || !Number.isSafeInteger(recorded.revision) || recorded.revision < 0) return { kind: "unavailable" };
  let bytes: Uint8Array;
  try {
    bytes = jcsUtf8Bytes(document);
  } catch {
    return { kind: "unavailable" };
  }
  const shown = await sha256Hex(bytes, subtle);
  if (shown === null) return { kind: "unavailable" };
  return { kind: shown === recorded.sha256 ? "match" : "mismatch", revision: recorded.revision, recorded: recorded.sha256, shown };
}

/** Riječi oznake, sitni dodatak i opis (puni SHA-256 samo u opisu). */
export function fingerprintLabel(state: FingerprintState): { label: string; small: string | null; title: string } {
  switch (state.kind) {
    case "checking": return { label: text.checking, small: null, title: text.checking };
    case "unavailable": return { label: text.unavailable, small: null, title: text.recheck };
    default: return {
      label: state.kind === "match" ? text.match : text.mismatch,
      small: text.version(state.revision),
      title: [text.recheck, text.recorded(state.revision, state.recorded), text.shown(state.shown)].join("\n"),
    };
  }
}
