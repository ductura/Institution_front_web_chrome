export type MarkerColor = { id: string; name: string; value: string };

const HUES: readonly (readonly [string, number])[] = [
  ["žuta", 54], ["narančasta", 32], ["crvena", 4], ["ružičasta", 335], ["ljubičasta", 285], ["plava", 225],
  ["svijetloplava", 195], ["tirkizna", 172], ["zelena", 135], ["limeta", 92], ["smeđa", 24], ["zlatna", 44],
];
const SHADES: readonly (readonly [string, number, number])[] = [
  ["svijetla", 88, 90], ["blaga", 78, 80], ["srednja", 68, 70], ["tamna", 52, 55],
];

/** 12 hues × 4 shades plus three greys: 51 colours, all fixed so a saved marker keeps its value. */
export const MARKER_PALETTE: readonly MarkerColor[] = [
  ...HUES.flatMap(([hue, angle]) => SHADES.map(([shade, lightness, saturation]) => ({
    id: `${angle}-${lightness}`, name: `${hue}, ${shade}`, value: `hsl(${angle} ${saturation}% ${lightness}%)`,
  }))),
  { id: "g-92", name: "siva, svijetla", value: "hsl(0 0% 92%)" },
  { id: "g-80", name: "siva, srednja", value: "hsl(0 0% 80%)" },
  { id: "g-65", name: "siva, tamna", value: "hsl(0 0% 65%)" },
];

const BY_VALUE = new Set(MARKER_PALETTE.map((color) => color.value));
const CUSTOM = /^#[0-9a-f]{6}$/i;

/** A marker value is stored only if it is a palette colour or a six-digit custom hex; anything else is dropped. */
export const safeMarker = (value: string | null | undefined): string | null =>
  value && (BY_VALUE.has(value) || CUSTOM.test(value)) ? value : null;
