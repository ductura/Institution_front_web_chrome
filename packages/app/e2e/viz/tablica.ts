// VIZ-TAMNA: the coverage table of the comparison. One row per screen of the
// prototypes (an app screen paired with it, or "nema para"), with the route,
// the frame (shell), the scenario and the share of differing pixels at the four
// widths in both themes. No browser and no dependency, so node --test reads it.

export type Sirine = readonly number[];
/** A percentage per width; null where that width was not measured. */
export type Postoci = readonly (number | null)[];

export type Redak = {
  /** The prototype screen: "Ductura_nastavnik.html#studenti". */
  readonly prototip: string;
  readonly naslov: string;
  /** The app screen paired with it, or null. */
  readonly ekran: string | null;
  readonly ruta: string;
  /** "side", "none" or "-" (a screen the prototypes have no frame record for). */
  readonly ljuska: string;
  readonly svijetla: Postoci;
  readonly tamna: Postoci;
};

const num = (p: number | null) => (p === null ? "—" : `${p.toFixed(1)} %`);
const esc = (s: string) => s.replace(/[&<>"|]/g, (c) => (c === "|" ? "\\|" : `&#${c.charCodeAt(0)};`));

/** The worst share of a row in both themes, or null when nothing was measured. */
export function najgore(r: Redak): number | null {
  const sve = [...r.svijetla, ...r.tamna].filter((p): p is number => p !== null);
  return sve.length === 0 ? null : Math.max(...sve);
}

/** The Markdown table (job summary, PR description). */
export function tablicaMd(redci: readonly Redak[], sirine: Sirine, scenarij: string, prag: number): string {
  const zaglavlje = ["prototip", "ekran aplikacije", "ruta", "ljuska", "scenarij",
    ...sirine.map((w) => `svijetla ${w}`), ...sirine.map((w) => `tamna ${w}`)];
  const mjereno = redci.filter((r) => najgore(r) !== null);
  const iznad = mjereno.filter((r) => (najgore(r) ?? 0) > prag).length;
  const linije = redci.map((r) => `| ${[
    `${esc(r.prototip)} ${esc(r.naslov)}`, r.ekran === null ? "nema para" : esc(r.ekran), r.ruta === "" ? "—" : `\`${r.ruta}\``, r.ljuska, scenarij,
    ...sirine.map((_, i) => num(r.svijetla[i] ?? null)), ...sirine.map((_, i) => num(r.tamna[i] ?? null)),
  ].join(" | ")} |`);
  return [
    `Pokrivenost: ${redci.length - redci.filter((r) => r.ekran === null).length} od ${redci.length} ekrana prototipa ima par; ${iznad} od ${mjereno.length} izmjerenih redaka ima mjerenje iznad ${prag} %.`,
    "", `| ${zaglavlje.join(" | ")} |`, `|${zaglavlje.map(() => "---").join("|")}|`, ...linije, "",
  ].join("\n");
}

/** The same table as an HTML fragment for viz-out/index.html. */
export function tablicaHtml(redci: readonly Redak[], sirine: Sirine, scenarij: string, prag: number): string {
  const e = (s: string) => esc(s).replace(/\\\|/g, "|");
  const celija = (p: number | null) => `<td class="num${p !== null && p > prag ? " bez" : ""}">${num(p)}</td>`;
  return `<h2>Tablica pokrivenosti</h2><table><tr><th rowspan="2">prototip</th><th rowspan="2">ekran aplikacije</th><th rowspan="2">ruta</th><th rowspan="2">ljuska</th><th rowspan="2">scenarij</th><th colspan="${sirine.length}">svijetla</th><th colspan="${sirine.length}">tamna</th></tr>
<tr>${[...sirine, ...sirine].map((w) => `<th>${w}</th>`).join("")}</tr>
${redci.map((r) => `<tr${r.ekran === null ? ` class="bez"` : ""}><td>${e(r.prototip)} ${e(r.naslov)}</td><td>${r.ekran === null ? "nema para" : e(r.ekran)}</td><td>${e(r.ruta) || "—"}</td><td>${r.ljuska}</td><td>${e(scenarij)}</td>${sirine.map((_, i) => celija(r.svijetla[i] ?? null)).join("")}${sirine.map((_, i) => celija(r.tamna[i] ?? null)).join("")}</tr>`).join("\n")}</table>`;
}
