import type { PageFormat } from "./page-format";
import { pagesMessages as t } from "./messages.hr";

const decimal = (value: number) => String(value).replace(".", ",");

export function marginsText({ margins: m }: PageFormat) {
  return `${t.left} ${decimal(m.left)} cm, ${t.right} ${decimal(m.right)} cm, ${t.above} ${decimal(m.top)} cm, ${t.bottom} ${decimal(m.bottom)} cm`;
}

export function numbersText(format: PageFormat) {
  const place = format.numberPosition === "right" ? t.numberBottomRight : t.numberBottomCenter;
  return `${place}, ${format.numberStart === "all" ? t.numberAll : t.numberIntro}`;
}

export const fontText = (format: PageFormat) => `${format.font}, ${decimal(format.size)} pt`;
export const spacingText = (format: PageFormat) => decimal(format.spacing);
