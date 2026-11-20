import type { PageFormat } from "./page-format";
import { pagesMessages as t } from "./messages.hr";

const decimal = (value: number) => String(value).replace(".", ",");

export function marginsText({ margins: m }: PageFormat) {
  return `${t.marginLeft} ${decimal(m.left)} cm, ${t.marginRight} ${decimal(m.right)} cm, ${t.marginTop} ${decimal(m.top)} cm, ${t.marginBottom} ${decimal(m.bottom)} cm`;
}

export function numbersText(format: PageFormat) {
  const place = format.numberPosition === "right" ? t.numberBottomRight : t.numberBottomCenter;
  return `${place}, ${format.numberStart === "all" ? t.numberAll : t.numberIntro}`;
}

export const fontText = (format: PageFormat) => `${format.font}, ${decimal(format.size)} pt`;
export const spacingText = (format: PageFormat) => decimal(format.spacing);
