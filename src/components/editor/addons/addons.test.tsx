import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

import { hslHex, MARKER_PALETTE, safeMarker } from "./marker-palette";
import { MarkerPalette } from "./MarkerPalette";
import { readAloud, speechSupport, startDictation } from "./speech";

it("has 51 unique colours and accepts only palette values or hex", () => {
  expect(MARKER_PALETTE).toHaveLength(51);
  expect(new Set(MARKER_PALETTE.map((c) => c.id)).size).toBe(51);
  expect(safeMarker(MARKER_PALETTE[0]!.value)).toBe(MARKER_PALETTE[0]!.value);
  expect(safeMarker("#ffcc00")).toBe("#ffcc00");
  expect(safeMarker("red; background:url(x)")).toBeNull();
  expect(safeMarker(null)).toBeNull();
});

it("keeps every colour as lowercase hex, the only form the v4 highlight mark takes (ED-107)", () => {
  for (const color of MARKER_PALETTE) expect(color.value).toMatch(/^#[0-9a-f]{6}$/);
  expect(hslHex(0, 0, 100)).toBe("#ffffff");
  expect(hslHex(0, 100, 50)).toBe("#ff0000");
  expect(hslHex(120, 100, 25)).toBe("#008000");
  expect(safeMarker("#FFCC00")).toBe("#ffcc00");
  expect(safeMarker("hsl(54 90% 88%)")).toBeNull();
});

it("offers Druga boja… and says the marker is the student's own (ED-107)", () => {
  const html = renderToStaticMarkup(<MarkerPalette onPick={() => {}} onRemove={() => {}} current="#123456" />);
  expect(html).toContain("Druga boja…");
  expect(html).toContain('type="color"');
  expect(html).toContain('value="#123456"');
  expect(html).toContain("Marker je Vaše označavanje. Mentor ga ne vidi i ne ide u izvoz.");
  expect(renderToStaticMarkup(<MarkerPalette onPick={() => {}} onRemove={() => {}} />)).toContain('value="#ffd966"');
});

it("renders every colour with a name and the remove action", () => {
  const html = renderToStaticMarkup(<MarkerPalette onPick={() => {}} onRemove={() => {}} current={MARKER_PALETTE[1]!.value} />);
  expect(html.match(/<button/g)).toHaveLength(52);
  expect(html).toContain("Ukloni marker");
  expect(html).toContain('aria-pressed="true"');
});

it("detects support from the host", () => {
  expect(speechSupport({})).toEqual({ dictation: false, reading: false });
  expect(speechSupport({ webkitSpeechRecognition: class {} as never, speechSynthesis: { speak() {}, cancel() {} }, SpeechSynthesisUtterance: class {} as never }))
    .toEqual({ dictation: true, reading: true });
});

it("dictation passes final phrases only and reports a denied microphone", () => {
  let instance: any;
  class Fake { lang = ""; start = vi.fn(); stop = vi.fn(); constructor() { instance = this; } }
  const phrases: string[] = []; const ends: string[] = [];
  const stop = startDictation((p) => phrases.push(p), (r) => ends.push(r), { SpeechRecognition: Fake as never });
  expect(instance.lang).toBe("hr-HR");
  instance.onresult({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: "pol" } }, { isFinal: true, 0: { transcript: " izmišljena rečenica " } }] });
  expect(phrases).toEqual(["izmišljena rečenica"]);
  instance.onerror({ error: "not-allowed" }); instance.onend();
  expect(ends).toEqual(["denied"]);
  stop!(); expect(instance.stop).toHaveBeenCalled();
  expect(startDictation(() => {}, () => {}, {})).toBeNull();
});

it("reads aloud in Croatian and refuses empty text", () => {
  const spoken: any[] = []; const cancel = vi.fn();
  class U { lang = ""; onend = null; onerror = null; constructor(public text: string) {} }
  const host = { speechSynthesis: { speak: (u: unknown) => spoken.push(u), cancel }, SpeechSynthesisUtterance: U as never };
  expect(readAloud("  ", () => {}, host)).toBe(false);
  expect(readAloud("Izmišljeni odlomak.", () => {}, host)).toBe(true);
  expect(spoken[0]).toMatchObject({ text: "Izmišljeni odlomak.", lang: "hr-HR" });
  expect(cancel).toHaveBeenCalled();
});
