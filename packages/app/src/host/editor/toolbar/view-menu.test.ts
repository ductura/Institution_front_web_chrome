// ED-44 (P2-16): Prikaz gets the prototype's "Ljuska" and lists its "Prikaz" group, disabled until the host has it.
import { describe, expect, it } from "vitest";

import { currentShell, pendingViewItems, PENDING_VIEWS, setShell, shellItems } from "./view-menu";

const rootWith = (theme: string | null) => {
  const attrs = new Map<string, string>(theme === null ? [] : [["data-theme", theme]]);
  return {
    getAttribute: (name: string) => attrs.get(name) ?? null,
    setAttribute: (name: string, value: string) => void attrs.set(name, value),
  };
};

const memory = () => {
  const kept = new Map<string, string>();
  return { kept, getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v) };
};

describe("Prikaz: Ljuska", () => {
  it("ticks the shell's theme the page carries", () => {
    expect(shellItems("dark").map((i) => i.label)).toEqual(["✓ Tamna ljuska", "Svijetla ljuska"]);
    expect(shellItems("light").map((i) => i.label)).toEqual(["Tamna ljuska", "✓ Svijetla ljuska"]);
  });

  it("reads the theme from <html>, else from the browser, else dark", () => {
    const store = memory();
    store.setItem("ductura.theme", "light");
    expect(currentShell(rootWith("light"), () => undefined)).toBe("light");
    expect(currentShell(rootWith(null), () => store)).toBe("light");
    expect(currentShell(rootWith(null), () => { throw new Error("blocked"); })).toBe("dark");
    expect(currentShell(null, () => undefined)).toBe("dark");
  });

  it("puts the choice on <html> and keeps it in the browser", () => {
    const root = rootWith("dark");
    const store = memory();
    expect(setShell(root, () => store, "light")).toBe("light");
    expect(root.getAttribute("data-theme")).toBe("light");
    expect(store.kept.get("ductura.theme")).toBe("light");
  });

  it("still changes the page when the browser keeps nothing", () => {
    const root = rootWith("dark");
    expect(setShell(root, () => { throw new Error("blocked"); }, "light")).toBe("light");
    expect(root.getAttribute("data-theme")).toBe("light");
  });
});

describe("Prikaz: what the host cannot show yet", () => {
  it("lists the prototype's Prikaz group, disabled and marked, never hidden", () => {
    const items = pendingViewItems();
    expect(items.map((i) => i.id)).toEqual([...PENDING_VIEWS]);
    expect(items.map((i) => i.label)).toEqual(["Sadržaj na listu", "Promjene od predaje mentoru", "Povijest rada", "Prvi redovi"]);
    for (const item of items) expect(item).toMatchObject({ disabled: true, hint: "nedostupno" });
  });
});

describe("Prikaz: Struktura rada i Čisti tekst (EDI-R17)", () => {
  it("lists both as live items, not pending", async () => {
    const { viewItems } = await import("./view-menu");
    expect(viewItems(false).map((i) => [i.id, i.label, i.disabled])).toEqual([
      ["structure", "Struktura rada", undefined], ["cleanText", "Čisti tekst (bez savjeta)", undefined],
    ]);
    expect(viewItems(true)[1]?.label).toBe("✓ Čisti tekst (bez savjeta)");
  });

  it("keeps Čisti tekst on <html> and in the browser; blocked storage still changes the page", async () => {
    const { readClean, setClean, CLEAN_KEY } = await import("./view-menu");
    const root = rootWith(null);
    const store = memory();
    expect(readClean(root, () => store)).toBe(false);
    expect(setClean(root, () => store, true)).toBe(true);
    expect(root.getAttribute("data-clean-text")).toBe("on");
    expect(store.kept.get(CLEAN_KEY)).toBe("on");
    expect(readClean(rootWith(null), () => store)).toBe(true);
    const blocked = () => { throw new Error("blocked"); };
    setClean(root, blocked, false);
    expect(root.getAttribute("data-clean-text")).toBe("off");
    expect(readClean(rootWith(null), blocked)).toBe(false);
  });
});
