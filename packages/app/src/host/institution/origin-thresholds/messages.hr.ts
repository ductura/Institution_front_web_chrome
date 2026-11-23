// Interface text of "Pragovi po vrsti podrijetla" (PIL-P1-PRAGOVI-ADMIN; P-1 rule 12). No text judges a
// student: a threshold only decides which neutral label the summary shows (u skladu / za pregled / prekoračeno).
import { originText } from "../../teacher/origin-map/messages.hr";
import type { OriginKind, Strictness } from "./contract";

const strictness = { hard: "Strogi", soft: "Blagi" } satisfies Record<Strictness, string>;

export const thresholdMessages = {
  title: "Pragovi po vrsti podrijetla",
  lead: "Fakultet za svaku vrstu podrijetla teksta može upisati prag u postotcima. Nema zadanih pragova: vrsta bez upisanog praga u sažetku nema oznaku.",
  notice: "Prag nije ocjena studenta i ne blokira predaju. Student vidi isto što i nastavnik.",
  kinds: {
    typed: originText.kindTyped,
    assistant_inserted: originText.kindAssistantInserted,
    assistant_match: originText.kindAssistantMatch,
    imported_file: originText.kindImportedFile,
    pasted_known: originText.kindPastedKnown,
    pasted_unknown: originText.kindPastedUnknown,
  } satisfies Record<OriginKind, string>,
  current: "Trenutačno",
  none: "Bez praga",
  shown: (percent: number, kind: Strictness) => `${percent} % · ${strictness[kind]}`,
  percent: "Prag (%)",
  percentHint: "Cijeli broj od 0 do 100.",
  percentInvalid: "Upišite cijeli broj od 0 do 100.",
  strictnessLabel: "Vrsta praga",
  strictnessPick: "Odaberite vrstu praga",
  strictnessMissing: "Odaberite vrstu praga.",
  strictness,
  strictnessHint: "Iznad strogog praga sažetak piše „prekoračeno”, iznad blagog „za pregled”.",
  save: "Spremi prag",
  remove: "Ukloni prag",
  saved: "Prag je spremljen na poslužitelju.",
  removed: "Prag je uklonjen. Vrsta je opet bez praga.",
  retry: "Pokušaj ponovno",
  reload: "Ponovno učitaj pragove",
  errors: {
    signedOut: "Prijava nije valjana. Prijavite se ponovno.",
    denied: "Pragove fakulteta vidi i mijenja samo administrator ustanove.",
    invalid: "Poslužitelj nije prihvatio ove vrijednosti. Provjerite polja i pokušajte ponovno.",
    notSent: "Vrijednosti nisu poslane jer ne odgovaraju obrascu. Provjerite polja.",
    unavailable: "Pragovi trenutačno nisu učitani jer poslužitelj nije odgovorio. Pokušajte ponovno.",
    unconfirmed: "Promjena nije potvrđena. Ponovno učitajte pragove i provjerite stanje.",
    staleAfterSave: "Promjena je potvrđena, ali pragovi nisu ponovno učitani. Ponovno učitajte pragove.",
  },
} as const;
