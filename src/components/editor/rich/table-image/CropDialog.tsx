"use client";

import { useState } from "react";

import { Button, Dialog } from "@ductura/ui";

import { clampSide, cropInset, MAX_CROP_PERCENT, normalizeCrop, NO_CROP } from "./image-ops";
import { tableImageMessages as t } from "./messages.hr";
import styles from "./table-image.module.css";
import type { ImageCrop } from "@/domain/document/schema";

type Props = {
  /** The whole picture, from the attachment; the crop is only ever a frame over it. */
  src: string;
  initial?: ImageCrop;
  onApply: (crop: ImageCrop | null) => void;
  onClose: () => void;
};

const SIDES = [
  ["left", t.cropLeft], ["right", t.cropRight], ["top", t.cropTop], ["bottom", t.cropBottom],
] as const;

export function CropDialog({ src, initial = NO_CROP, onApply, onClose }: Props) {
  const [crop, setCrop] = useState<ImageCrop>(initial);
  return (
    <Dialog
      open title={t.cropTitle} onClose={onClose}
      actions={<>
        <Button tone="quiet" onClick={onClose}>{t.cropCancel}</Button>
        <Button tone="quiet" onClick={() => setCrop(NO_CROP)}>{t.cropReset}</Button>
        <Button onClick={() => onApply(normalizeCrop(crop))}>{t.cropApply}</Button>
      </>}
    >
      <p>{t.cropNote}</p>
      <div className={styles.cropStage}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={t.cropAlt} />
        <div className={styles.cropFrame} style={{ inset: cropInset(crop) }} data-testid="crop-frame" />
      </div>
      <div className={styles.cropSliders}>
        {SIDES.map(([side, label]) => (
          <label key={side}>
            <span>{label}</span>
            <input
              type="range" min={0} max={MAX_CROP_PERCENT} value={crop[side]}
              onChange={(e) => setCrop({ ...crop, [side]: clampSide(Number(e.target.value)) })}
            />
          </label>
        ))}
      </div>
    </Dialog>
  );
}
