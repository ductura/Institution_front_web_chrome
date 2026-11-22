/** Code points, the unit of the limit (what the reader sees as characters). */
export function codePointCount(text: string): number {
  let n = 0;
  for (const _ of text) n += 1;
  return n;
}

/** "412 od 1000 znakova": one text only, never a sum over events and never a score. */
export function counterText(template: string, used: number, max: number): string {
  return template.replace("{used}", String(used)).replace("{max}", String(max));
}
