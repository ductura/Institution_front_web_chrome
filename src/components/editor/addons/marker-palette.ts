export type MarkerColor = { id: string; name: string; value: string };

const HUES: readonly (readonly [string, number])[] = [
  ["žuta", 54], ["narančasta", 32], ["crvena", 4], ["ružičasta", 335], ["ljubičasta", 285], ["plava", 225],
  ["svijetloplava", 195], ["tirkizna", 172], ["zelena", 135], ["limeta", 92], ["smeđa", 24], ["zlatna", 44],
];
const SHADES: readonly (readonly [string, number, number])[] = [
  ["svijetla", 88, 90], ["blaga", 78, 80], ["srednja", 68, 70], ["tamna", 52, 55],
];

/**
 * ED-107: a colour as six lowercase hex digits, the only form the highlight mark of document v4 takes
 * (validate-marks-v4 `COLOR`); an `hsl()` value would be refused by `setHighlight`.
 */
export function hslHex(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100, l = lightness / 100;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/** The starting colour of "Druga boja…", as in the prototype (pages.js `pgPick`). */
export const CUSTOM_MARKER_START = "#ffd966";

/** 12 hues × 4 shades plus three greys: 51 colours, all fixed so a saved marker keeps its value. */
export const MARKER_PALETTE: readonly MarkerColor[] = [
  ...HUES.flatMap(([hue, angle]) => SHADES.map(([shade, lightness, saturation]) => ({
    id: `${angle}-${lightness}`, name: `${hue}, ${shade}`, value: hslHex(angle, saturation, lightness),
  }))),
  { id: "g-92", name: "siva, svijetla", value: hslHex(0, 0, 92) },
  { id: "g-80", name: "siva, srednja", value: hslHex(0, 0, 80) },
  { id: "g-65", name: "siva, tamna", value: hslHex(0, 0, 65) },
];

const BY_VALUE = new Set(MARKER_PALETTE.map((color) => color.value));
const CUSTOM = /^#[0-9a-f]{6}$/;

/** A marker value is stored only if it is a palette colour or a six-digit custom hex (lowercased); anything else is dropped. */
export const safeMarker = (value: string | null | undefined): string | null => {
  const lower = value?.toLowerCase();
  return lower && (BY_VALUE.has(lower) || CUSTOM.test(lower)) ? lower : null;
};
