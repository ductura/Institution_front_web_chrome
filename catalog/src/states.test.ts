import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CATALOG_STATES, type CatalogState } from "./coverage";
import { ENTRIES } from "./entries";

// web 2.c2 (DAN-751): every catalogue component in every state, rendered the
// way the catalogue renders it, with the semantics that state must carry.
const html = (name: keyof typeof ENTRIES, state: CatalogState) =>
  renderToStaticMarkup(createElement(Fragment, null, ENTRIES[name][state]()));
const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const count = (markup: string, pattern: RegExp) => (markup.match(new RegExp(pattern, "g")) ?? []).length;

// Roots from the PRODUCT §5 vocabulary that a component state could plausibly
// show; the full scanner comes with 2.c4. A bare "Spremljeno" is also banned.
const FORBIDDEN = [
  /sumnj/i, /rizik/i, /anomalij/i, /vjerojatn/i, /autentičn/i, /autenticitet/i, /kopiran/i, /prepisan/i,
  /plagij/i, /izvornost/i, /originalnost/i, /integritet/i, /neobičn/i, /neuobičajen/i, /skriven/i,
  /nestal/i, /spremljeno(?! na (uređaju|poslužitelju))/i,
];

describe("every catalogue state renders Croatian text with no forbidden term", () => {
  for (const name of Object.keys(ENTRIES) as (keyof typeof ENTRIES)[]) {
    for (const state of CATALOG_STATES) {
      it(`${name} · ${state}`, () => {
        const shown = text(html(name, state));
        expect(shown).not.toBe("");
        for (const term of FORBIDDEN) expect(shown).not.toMatch(term);
      });
    }
  }

  it("the forbidden list catches a bare save claim but not the qualified ones", () => {
    const hits = (s: string) => FORBIDDEN.some((t) => t.test(s));
    expect(hits("Spremljeno")).toBe(true);
    expect(hits("Spremljeno na uređaju")).toBe(false);
    expect(hits("Spremljeno na poslužitelju")).toBe(false);
  });
});

describe("Button states", () => {
  it("prazno: a quiet button that works", () => {
    const m = html("Button", "prazno");
    expect(m).toMatch(/data-tone="quiet"/);
    expect(m).not.toMatch(/disabled|aria-busy/);
  });

  it("učitavanje: busy, aria-disabled, never disabled (stays focusable)", () => {
    const m = html("Button", "učitavanje");
    expect(m).toMatch(/aria-busy="true"/);
    expect(m).toMatch(/aria-disabled="true"/);
    expect(m).not.toMatch(/ disabled=""/);
    expect(text(m)).toBe("Spremanje…");
  });

  it("greška: offers a retry that works", () => {
    const m = html("Button", "greška");
    expect(text(m)).toBe("Pokušaj ponovno");
    expect(m).not.toMatch(/disabled|aria-busy/);
  });

  it("puno: the primary button, plain type=button", () => {
    const m = html("Button", "puno");
    expect(m).toMatch(/data-tone="primary"/);
    expect(m).toMatch(/type="button"/);
    expect(m).not.toMatch(/disabled|aria-busy/);
  });

  it("onemogućeno: natively disabled, not busy", () => {
    const m = html("Button", "onemogućeno");
    expect(m).toMatch(/ disabled=""/);
    expect(m).not.toMatch(/aria-busy/);
  });
});

describe("TextField states", () => {
  const input = (m: string) => m.match(/<input[^>]*>/)?.[0] ?? "";
  const labelled = (m: string) => {
    const id = input(m).match(/ id="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(m).toContain(`for="${id}"`);
    return id!;
  };

  it("every state labels its input with the field's name", () => {
    for (const state of CATALOG_STATES) {
      const m = html("TextField", state);
      labelled(m);
      expect(m).toMatch(/<label[^>]*>Naslov rada<\/label>/);
    }
  });

  it("prazno: empty, with a placeholder and no note", () => {
    const m = html("TextField", "prazno");
    expect(input(m)).toMatch(/placeholder="Npr\. /);
    expect(input(m)).not.toMatch(/value="[^"]/);
    expect(input(m)).not.toMatch(/aria-describedby|aria-invalid/);
  });

  it("učitavanje: read-only and busy, the note says it is loading", () => {
    const m = html("TextField", "učitavanje");
    const id = labelled(m);
    expect(input(m)).toMatch(/readonly=""/i);
    expect(input(m)).toMatch(/aria-busy="true"/);
    expect(input(m)).toContain(`aria-describedby="${id}-note"`);
    expect(m).toMatch(new RegExp(`<p id="${id}-note"[^>]*>Učitavanje…</p>`));
  });

  it("greška: invalid, the error is the described note and marked as error", () => {
    const m = html("TextField", "greška");
    const id = labelled(m);
    expect(input(m)).toMatch(/aria-invalid="true"/);
    expect(input(m)).toContain(`aria-describedby="${id}-note"`);
    expect(m).toMatch(/<p[^>]*data-error=""[^>]*>Upišite naslov rada\.<\/p>/);
  });

  it("puno: holds a value and a hint that is not an error", () => {
    const m = html("TextField", "puno");
    expect(input(m)).toMatch(/value="Javne politike u lokalnoj zajednici"/);
    expect(input(m)).not.toMatch(/aria-invalid|readonly|disabled/i);
    expect(m).toMatch(/<p[^>]*>Najviše 120 znakova\.<\/p>/);
    expect(m).not.toMatch(/data-error/);
  });

  it("onemogućeno: natively disabled, keeps its value", () => {
    const m = html("TextField", "onemogućeno");
    expect(input(m)).toMatch(/ disabled=""/);
    expect(input(m)).toMatch(/value="Javne politike/);
  });
});

describe("SaveState states", () => {
  const chips = (m: string) => [...m.matchAll(/<span role="status"[^>]*data-tone="([a-z]+)"[^>]*>.*?<\/span>([^<]*)<\/span>/g)]
    .map(([, tone, label]) => `${tone}:${label}`);

  it("each state shows the chips the sync machine would, with their tones", () => {
    expect(chips(html("SaveState", "prazno"))).toEqual(["neutral:Uređivanje"]);
    expect(chips(html("SaveState", "učitavanje"))).toEqual(["progress:Spremam lokalno", "progress:Sinkroniziram"]);
    expect(chips(html("SaveState", "greška"))).toEqual(["warn:Sukob", "error:Greška", "error:Potreban oporavak"]);
    expect(chips(html("SaveState", "puno")))
      .toEqual(["neutral:Spremljeno na uređaju", "ok:Spremljeno na poslužitelju"]);
    expect(chips(html("SaveState", "onemogućeno"))).toEqual(["warn:Dokument je otvoren u drugoj kartici."]);
  });

  it("only SYNCED, in puno, earns the ok tone", () => {
    for (const state of CATALOG_STATES) {
      expect(count(html("SaveState", state), /data-tone="ok"/)).toBe(state === "puno" ? 1 : 0);
    }
  });

  it("the dot is hidden from assistive technology in every state", () => {
    for (const state of CATALOG_STATES) {
      const m = html("SaveState", state);
      expect(count(m, /aria-hidden="true"/)).toBe(count(m, /role="status"/));
    }
  });
});

describe("Card states", () => {
  const heading = (m: string) => {
    const id = m.match(/<h3 id="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(m).toContain(`aria-labelledby="${id}"`);
  };

  it("every state is a section named by its heading", () => {
    for (const state of CATALOG_STATES) heading(html("Card", state));
  });

  it("prazno: says it is empty, nothing else", () => {
    const m = html("Card", "prazno");
    expect(text(m)).toBe("Još nemate kolegija. Ovdje će se prikazati Vaši kolegiji i njihovi zadaci.");
    expect(m).not.toMatch(/aria-busy|aria-disabled|role="alert"/);
  });

  it("učitavanje: busy and says it is loading", () => {
    const m = html("Card", "učitavanje");
    expect(m).toMatch(/aria-busy="true"/);
    expect(text(m)).toBe("Moji radovi Učitavanje…");
  });

  it("greška: the message is an alert and replaces the content", () => {
    const m = html("Card", "greška");
    expect(m).toMatch(/<p role="alert"[^>]*>Podatke nije bilo moguće učitati\. To ne znači da nema kolegija ili radova\.<\/p>/);
    expect(m).not.toMatch(/aria-busy/);
  });

  it("puno: shows its content", () => {
    const m = html("Card", "puno");
    expect(text(m)).toBe("Seminarski rad Uvod u temu i plan poglavlja.");
    expect(m).not.toMatch(/aria-busy|aria-disabled|role="alert"/);
  });

  it("onemogućeno: marked disabled, content still readable", () => {
    const m = html("Card", "onemogućeno");
    expect(m).toMatch(/aria-disabled="true"/);
    expect(text(m)).toContain("Zadatak je zatvoren.");
  });
});
