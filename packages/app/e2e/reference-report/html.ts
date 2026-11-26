// DAN-1565: the report as one HTML file with every image inside it, so it
// opens from disk without a network. Pure: rows in, text out.

export type ReportRow = {
  readonly screen: string;
  readonly route: string;
  readonly theme: string;
  readonly width: number;
  /** PNG, base64. */
  readonly actual: string;
  /** Absent when the screen has no reference image: never a pass. */
  readonly compared?: {
    readonly referenceFile: string;
    readonly reference: string;
    readonly diff: string;
    readonly percent: number;
    readonly sameSize: boolean;
  };
  /** Why there is no comparison, for the reader. */
  readonly missing?: string;
};

export const reportText = {
  title: "Stvarni ekrani prema referentnim slikama",
  intro: "Postotak je udio piksela koji se razlikuju. Nije prolaz ni pad: odluku donosi osoba koja gleda slike.",
  noReference: "nema reference",
  reference: "Referenca",
  actual: "Stvarna snimka",
  difference: "Razlika",
  differentSize: "slike nisu iste veličine",
  summary: "Pregled",
  screen: "Ekran",
  theme: "Tema",
  width: "Širina",
  result: "Razlika piksela",
} as const;

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** `12,3 %` in Croatian notation; one decimal, never rounded down to a clean zero. */
export function formatPercent(percent: number): string {
  if (percent > 0 && percent < 0.1) return "< 0,1 %";
  return `${percent.toFixed(1).replace(".", ",")} %`;
}

const image = (base64: string, alt: string) =>
  `<img loading="lazy" src="data:image/png;base64,${base64}" alt="${escapeHtml(alt)}">`;

const resultOf = (row: ReportRow) =>
  row.compared === undefined
    ? `<strong class="none">${reportText.noReference}</strong>`
    : `${formatPercent(row.compared.percent)}${row.compared.sameSize ? "" : ` (${reportText.differentSize})`}`;

function section(row: ReportRow, index: number): string {
  const name = `${row.screen} · ${row.route} · ${row.theme} · ${row.width}`;
  const figures = row.compared === undefined
    ? `<figure><figcaption>${reportText.reference}</figcaption><p class="none">${reportText.noReference}${
        row.missing === undefined ? "" : `: ${escapeHtml(row.missing)}`}</p></figure>
<figure><figcaption>${reportText.actual}</figcaption>${image(row.actual, `${reportText.actual}: ${name}`)}</figure>`
    : `<figure><figcaption>${reportText.reference} (${escapeHtml(row.compared.referenceFile)})</figcaption>${
        image(row.compared.reference, `${reportText.reference}: ${name}`)}</figure>
<figure><figcaption>${reportText.actual}</figcaption>${image(row.actual, `${reportText.actual}: ${name}`)}</figure>
<figure><figcaption>${reportText.difference}</figcaption>${image(row.compared.diff, `${reportText.difference}: ${name}`)}</figure>`;
  return `<section id="r${index}"><h2>${escapeHtml(name)}: ${resultOf(row)}</h2><div class="row">${figures}</div></section>`;
}

/** The whole report. `generatedAt` and `source` are shown as given. */
export function buildReport(rows: readonly ReportRow[], meta: { generatedAt: string; source: string }): string {
  const summary = rows.map((row, index) =>
    `<tr><td><a href="#r${index}">${escapeHtml(row.screen)} ${escapeHtml(row.route)}</a></td><td>${
      escapeHtml(row.theme)}</td><td>${row.width}</td><td>${resultOf(row)}</td></tr>`).join("\n");
  return `<!doctype html>
<html lang="hr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${reportText.title}</title>
<style>
body { font: 16px/1.5 system-ui, sans-serif; margin: 0; padding: 16px; background: #f6f5f1; color: #1f1f1d; }
h1 { font-size: 1.4rem; } h2 { font-size: 1rem; margin: 32px 0 8px; }
table { border-collapse: collapse; } td, th { padding: 4px 12px; border-bottom: 1px solid #cfcdc4; text-align: left; }
.row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; align-items: start; }
figure { margin: 0; } figcaption { font-size: 0.85rem; margin-bottom: 4px; overflow-wrap: anywhere; }
img { max-width: 100%; height: auto; border: 1px solid #cfcdc4; background: #fff; }
.none { color: #8a2b06; }
@media (max-width: 720px) { .row { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<h1>${reportText.title}</h1>
<p>${reportText.intro}</p>
<p>${escapeHtml(meta.generatedAt)} · ${escapeHtml(meta.source)}</p>
<h2>${reportText.summary}</h2>
<table>
<thead><tr><th>${reportText.screen}</th><th>${reportText.theme}</th><th>${reportText.width}</th><th>${reportText.result}</th></tr></thead>
<tbody>
${summary}
</tbody>
</table>
${rows.map(section).join("\n")}
</body>
</html>
`;
}
