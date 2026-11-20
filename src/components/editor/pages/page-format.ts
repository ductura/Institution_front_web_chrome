/** Page format derived from a faculty rule profile (margins, typeface, spacing, page numbers). */

export type RuleProfile = {
  readonly label?: string;
  readonly unit?: string;
  readonly font?: string;
  readonly size?: number;
  readonly spacing?: number;
  readonly facts?: readonly string[];
  readonly manualChecks?: readonly string[];
};

export type Margins = { top: number; right: number; bottom: number; left: number };

export type PageFormat = {
  readonly font: string;
  readonly size: number;
  readonly spacing: number;
  readonly margins: Margins;
  readonly numberPosition: "center" | "right";
  readonly numberStart: "intro" | "all";
  readonly known: { font: boolean; size: boolean; spacing: boolean; margins: boolean; numbering: boolean };
  readonly sources: readonly string[];
  readonly coverRules: readonly string[];
  readonly label: string;
  readonly unit: string;
};

export const DEFAULT_MARGIN_CM = 2.5;
export const PAGE_WIDTH_CM = 21;
export const PAGE_HEIGHT_CM = 29.7;

const fold = (text: string) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const cm = (text: string) => parseFloat(text.replace(",", "."));
const NUMBER = String.raw`(\d+(?:[.,]\d+)?)`;

function readMargins(all: string): { margins: Margins; pattern?: RegExp } {
  const leftRest = new RegExp(String.raw`lijev\w*\s+${NUMBER}\s*cm[^·]{0,30}?ostale\s+${NUMBER}`);
  const pair = new RegExp(String.raw`margine\s+${NUMBER}\s*\/\s*${NUMBER}\s*cm`);
  const single = new RegExp(String.raw`margine\s+${NUMBER}\s*cm`);
  let hit: RegExpExecArray | null;
  if ((hit = leftRest.exec(all)) || (hit = pair.exec(all))) {
    const [left, rest] = [cm(hit[1]), cm(hit[2])];
    return { margins: { top: rest, right: rest, bottom: rest, left }, pattern: /margin|lijev/ };
  }
  if ((hit = single.exec(all))) {
    const all4 = cm(hit[1]);
    return { margins: { top: all4, right: all4, bottom: all4, left: all4 }, pattern: /margin/ };
  }
  const d = DEFAULT_MARGIN_CM;
  return { margins: { top: d, right: d, bottom: d, left: d } };
}

const valid = (value: number) => (value >= 1 && value <= 5 ? value : DEFAULT_MARGIN_CM);

export function derivePageFormat(profile?: RuleProfile): PageFormat {
  const facts = [...(profile?.facts ?? []), ...(profile?.manualChecks ?? [])];
  const all = fold(facts.join(" · "));
  const found = readMargins(all);
  const margins: Margins = {
    top: valid(found.margins.top), right: valid(found.margins.right),
    bottom: valid(found.margins.bottom), left: valid(found.margins.left),
  };
  const right = /desn\w+\s+(kut|ugl)/.test(all);
  const fromIntro = /od uvoda|uvod\w*\s+pocinje|pocinj\w+[^·]{0,40}uvod|zapocinj\w+[^·]{0,40}uvod|prva numerirana[^·]{0,40}uvod/.test(all);
  const everyPage = !fromIntro && /sve\s+(se\s+)?stranice[^·]{0,30}numerir/.test(all);
  const sources: string[] = [];
  const cite = (test: (fact: string) => boolean) => {
    const fact = facts.find((item) => test(fold(item)));
    if (fact && !sources.includes(fact)) sources.push(fact);
  };
  if (found.pattern) cite((fact) => found.pattern!.test(fact));
  if (right) cite((fact) => /desn\w+\s+(kut|ugl)/.test(fact));
  if (fromIntro) cite((fact) => /uvod/.test(fact));
  return {
    font: profile?.font ? profile.font.split(/\s+ili\s+|,|\//)[0].trim() : "Times New Roman",
    size: profile?.size ?? 12,
    spacing: profile?.spacing ?? 1.5,
    margins,
    numberPosition: right ? "right" : "center",
    numberStart: everyPage ? "all" : "intro",
    known: {
      font: Boolean(profile?.font), size: Boolean(profile?.size), spacing: Boolean(profile?.spacing),
      margins: /margin/.test(all), numbering: right || fromIntro || everyPage,
    },
    sources,
    coverRules: facts.filter((fact) => /naslovn|korice/.test(fold(fact))),
    label: profile?.label ?? "",
    unit: profile?.unit ?? "",
  };
}

/** Text height of one A4 page in cm, after top and bottom margins. */
export const textHeightCm = (format: PageFormat) => PAGE_HEIGHT_CM - format.margins.top - format.margins.bottom;
