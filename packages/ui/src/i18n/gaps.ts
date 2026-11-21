/**
 * Key parity of two text tables (D-70: "no untranslated keys"). The reference
 * is the Croatian table; every other language must have the same keys, the
 * same list lengths, the same `{placeholders}` and, for a text built by a
 * function, the same number of arguments.
 */
export type Gaps = { readonly missing: readonly string[]; readonly extra: readonly string[]; readonly placeholders: readonly string[] };

type Leaf = { readonly kind: "text"; readonly holes: string } | { readonly kind: "function"; readonly arity: number };

function holes(text: string): string {
  return [...new Set(text.match(/\{\w+\}/g) ?? [])].sort().join(" ");
}

function leaves(node: unknown, path: readonly string[], out: Map<string, Leaf>): void {
  const key = JSON.stringify(path);
  if (typeof node === "string") out.set(key, { kind: "text", holes: holes(node) });
  else if (typeof node === "function") out.set(key, { kind: "function", arity: node.length });
  else if (node !== null && typeof node === "object") {
    const entries = Object.entries(node);
    if (entries.length === 0) out.set(key, { kind: "text", holes: "" });
    for (const [k, v] of entries) leaves(v, [...path, k], out);
  } else out.set(key, { kind: "text", holes: "\u0000not text" });
}

const shown = (key: string) => (JSON.parse(key) as string[]).join(".");

export function keyGaps(reference: unknown, other: unknown): Gaps {
  const want = new Map<string, Leaf>();
  const have = new Map<string, Leaf>();
  leaves(reference, [], want);
  leaves(other, [], have);
  const missing: string[] = [];
  const placeholders: string[] = [];
  for (const [key, leaf] of want) {
    const got = have.get(key);
    if (got === undefined || got.kind !== leaf.kind || (got.kind === "text" && got.holes.startsWith("\u0000"))) missing.push(shown(key));
    else if (got.kind === "text" && leaf.kind === "text" ? got.holes !== leaf.holes : got.kind === "function" && leaf.kind === "function" && got.arity !== leaf.arity) {
      placeholders.push(shown(key));
    }
  }
  const extra = [...have.keys()].filter((key) => !want.has(key) || want.get(key)?.kind !== have.get(key)?.kind).map(shown);
  return { missing, extra, placeholders };
}
