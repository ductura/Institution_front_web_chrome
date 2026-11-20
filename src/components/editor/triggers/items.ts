import type { Editor } from "@tiptap/core";

import { editorTriggersHr as t } from "./messages.hr";

export type Source = {
  id: string;
  label: string;
  title: string;
  search: string;
  notes?: readonly { id: string; page: string; text: string }[];
};

export type Command = keyof typeof t.command;
type BuiltIn = "provjera" | "izvor" | "poglavlje" | "potpoglavlje" | "citat" | "popis";
export type Actions = {
  cite?: (sourceId: string, page: string) => void;
  addSource?: (author: string) => void;
  commands?: Partial<Record<Exclude<Command, BuiltIn | "navod">, () => void>>;
};
type BuiltInChain = ReturnType<Editor["chain"]>;
export const builtIn: Record<BuiltIn, (chain: BuiltInChain) => BuiltInChain> = {
  provjera: (chain) => chain.insertContent("[?] "),
  izvor: (chain) => chain.insertContent("[izvor] "),
  poglavlje: (chain) => chain.setNode("heading", { level: 2 }),
  potpoglavlje: (chain) => chain.setNode("heading", { level: 3 }),
  citat: (chain) => chain.toggleNode("quote", "paragraph"),
  popis: (chain) => chain.toggleNode("bulletItem", "paragraph"),
};

export type Trigger = { mode: "at" | "slash" | "cite"; query: string; from: number; to: number };
export type Item = { id: string; label: string; hint: string; disabled?: boolean; run?: () => void; transform?: (chain: BuiltInChain) => BuiltInChain };

export function triggerAt(before: string, to: number): Trigger | null {
  const match = before.match(/(?:^|[\s(\uFFFC])([@/])([\p{L}\d]{0,14})$/u);
  if (!match || match[2] === undefined) return null;
  return { mode: match[1] === "@" ? "at" : "slash", query: match[2], from: to - match[2].length - 1, to };
}

export function triggerItems(trigger: Trigger, sources: readonly Source[], actions: Actions, openCite: () => void): Item[] {
  const query = trigger.query.toLocaleLowerCase("hr");
  if (trigger.mode === "slash") {
    return (Object.keys(t.command) as Command[]).flatMap((id) => {
      const [label, hint] = t.command[id];
      if (!id.startsWith(query) && !label.toLocaleLowerCase("hr").startsWith(query)) return [];
      const transform = id in builtIn ? builtIn[id as BuiltIn] : undefined;
      const run = id === "navod" && (actions.cite || actions.addSource) ? openCite : actions.commands?.[id as keyof NonNullable<Actions["commands"]>];
      return [{ id, label: `/${id}`, hint, transform, run, disabled: !transform && !run }];
    });
  }

  const matching = sources.filter((source) => !query || `${source.search} ${source.label} ${source.title}`.toLocaleLowerCase("hr")
    .split(/[\s,()]+/).some((word) => word.startsWith(query)));
  const items = (trigger.mode === "at" ? matching.slice(0, 8) : matching).flatMap((s): Item[] => {
    const row = (id: string, label: string, hint: string, page: string): Item => ({ id, label, hint,
      disabled: !actions.cite, run: () => actions.cite?.(s.id, page) });
    return [row(`source:${s.id}`, s.label, s.title.slice(0, 30), ""), ...(s.notes ?? []).map((note) =>
      row(`note:${s.id}:${note.id}`, `${s.label}, ${t.page.replace("{page}", note.page)}`, `${note.text.slice(0, 26)}…`, note.page))];
  });
  if (trigger.mode === "cite") return items;
  return [...items.slice(0, 9), { id: "add", label: t.addSource, hint: trigger.query ? t.author.replace("{query}", trigger.query) : t.sourceHint,
    disabled: !actions.addSource, run: () => actions.addSource?.(trigger.query.charAt(0).toLocaleUpperCase("hr") + trigger.query.slice(1)) }];
}

export function moveItem(items: readonly Item[], active: number, direction: 1 | -1): number {
  const start = active === -1 && direction === -1 ? 0 : active;
  for (let step = 1; step <= items.length; step++) {
    const index = (start + direction * step + items.length) % items.length;
    if (!items[index]?.disabled) return index;
  }
  return -1;
}
