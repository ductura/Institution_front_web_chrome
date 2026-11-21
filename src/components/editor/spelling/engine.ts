/**
 * The Croatian Hunspell dictionary, read from the local static files in
 * public/dictionaries/hr (53 711 words, LGPL-2.1 or SISSL, see LICENSE.txt).
 * Hunspell itself (hunspell-asm, WebAssembly) runs in the browser, because the
 * dictionary uses affix aliases (AF) that pure-JS checkers do not read.
 * Nothing about the work is sent anywhere: the only requests are the two
 * dictionary files (WEB-1104).
 */
import { loadModule } from "hunspell-asm";

import type { Speller } from "./words";

export const DICTIONARY_BASE = "/dictionaries/hr";

type Fetch = (url: string) => Promise<{ ok: boolean; arrayBuffer(): Promise<ArrayBuffer> }>;

/** Builds a checker from the bytes of a Hunspell .aff and .dic. */
export async function createSpeller(aff: ArrayBuffer | Uint8Array, dic: ArrayBuffer | Uint8Array): Promise<Speller> {
  const factory = await loadModule();
  const bytes = (b: ArrayBuffer | Uint8Array) => (b instanceof Uint8Array ? b : new Uint8Array(b));
  const hunspell = factory.create(factory.mountBuffer(bytes(aff), "hr.aff"), factory.mountBuffer(bytes(dic), "hr.dic"));
  const cache = new Map<string, boolean>();
  return {
    correct(word) {
      let v = cache.get(word);
      if (v === undefined) { v = hunspell.spell(word); cache.set(word, v); }
      return v;
    },
    suggest: (word) => hunspell.suggest(word),
  };
}

let loading: Promise<Speller> | null = null;

/** Fetches the two local files once per page; a failed load can be retried. */
export function loadHrSpeller(fetcher: Fetch = (u) => fetch(u, { credentials: "omit" }), base: string = DICTIONARY_BASE): Promise<Speller> {
  loading ??= (async () => {
    const [aff, dic] = await Promise.all([`${base}/hr.aff`, `${base}/hr.dic`].map(async (url) => {
      const r = await fetcher(url);
      if (!r.ok) throw new Error(`dictionary ${url}`);
      return r.arrayBuffer();
    }));
    return createSpeller(aff!, dic!);
  })().catch((e) => { loading = null; throw e; });
  return loading;
}
