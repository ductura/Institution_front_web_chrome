"use client";

import { Button } from "@ductura/ui";

import { clampWidth, MAX_WIDTH_PERCENT, MIN_WIDTH_PERCENT, type Align, type ImageState } from "./image-ops";
import { tableImageMessages as t } from "./messages.hr";
import styles from "./table-image.module.css";

export type ImageAction = "pick" | "crop" | "landscape" | "remove" | "smaller" | "larger";

type Props = {
  image: ImageState;
  onAction: (action: ImageAction) => void;
  onAlign: (align: Align) => void;
  onWidth: (percent: number) => void;
};

const ALIGNS: readonly (readonly [Align, string])[] = [
  ["left", t.alignLeft], ["center", t.alignCenter], ["right", t.alignRight],
];

/** The bar under an attached image (E§3.6 rich). Without a picture there is nothing to edit but "Odaberi sliku". */
export function ImageBar({ image, onAction, onAlign, onWidth }: Props) {
  if (!image.attachmentId) {
    return (
      <div role="toolbar" aria-label={t.imageBar} className={styles.bar} contentEditable={false}>
        <Button tone="quiet" onClick={() => onAction("pick")}>{t.pick}</Button>
      </div>
    );
  }
  return (
    <div role="toolbar" aria-label={t.imageBar} className={styles.bar} contentEditable={false}>
      <Button tone="quiet" onClick={() => onAction("pick")}>{t.replace}</Button>
      <Button tone="quiet" onClick={() => onAction("crop")} aria-pressed={image.crop !== undefined}>{t.crop}</Button>
      {ALIGNS.map(([value, label]) => (
        <Button key={value} tone="quiet" aria-pressed={image.align === value} onClick={() => onAlign(value)}>{label}</Button>
      ))}
      <label className={styles.width}>
        <span>{t.widthLabel}</span>
        <input
          type="range" min={MIN_WIDTH_PERCENT} max={MAX_WIDTH_PERCENT} step={1} value={image.widthPercent}
          aria-valuetext={t.widthValue.replace("{percent}", String(image.widthPercent))}
          onChange={(e) => onWidth(clampWidth(Number(e.target.value)))}
        />
        <output>{t.widthValue.replace("{percent}", String(image.widthPercent))}</output>
      </label>
      <Button tone="quiet" aria-pressed={image.landscape} title={t.landscapeTitle} onClick={() => onAction("landscape")}>{t.landscape}</Button>
      <Button tone="quiet" onClick={() => onAction("remove")}>{t.remove}</Button>
    </div>
  );
}
