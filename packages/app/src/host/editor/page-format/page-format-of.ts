// F4-PM1-R12A (PM1-93): the page format the student's "Oblik stranice" shows, derived from the same rule
// profile "Kostur rada" uses. The app's profile carries its checks as objects and its faculty as a unit id;
// derivePageFormat reads texts and a unit name, so only that is handed over. Read only: nothing is saved.
import { derivePageFormat, type PageFormat } from "@/components/editor/pages/page-format";

import { unitById, type RuleProfile } from "../rules/profiles";

export function pageFormatOf(profile: RuleProfile | null): PageFormat {
  if (!profile) return derivePageFormat();
  return derivePageFormat({
    label: profile.label,
    unit: unitById(profile.unitId)?.name,
    font: profile.font,
    size: profile.size,
    spacing: profile.spacing,
    manualChecks: profile.manualChecks.map((check) => check.text),
  });
}
