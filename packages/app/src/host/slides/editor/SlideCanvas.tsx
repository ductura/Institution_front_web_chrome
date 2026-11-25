"use client";

// WEB-V13-UREDNIK: the canvas of one slide: its layout and a field for every
// place of that layout. Text blocks are edited here; a list block shows its
// items as fields; an image is shown by its description (images come in with
// attachments, not here).
import { Select } from "@ductura/ui";
import { LAYOUT_SLOTS, type Slide, type SlideBlock, type SlideLayout, type SlideSlot } from "../../../../../editor-core/src/slides/index.ts";
import { DraftField } from "./DraftField.tsx";
import { compatibleLayouts, slotBlockType } from "./editor-model.ts";
import { fill, layoutLabels, slidesEditorText as t, slotLabels } from "./messages.hr.ts";
import styles from "./editor.module.css";

export type SlideCanvasProps = {
  slide: Slide;
  readOnly: boolean;
  epoch: number;
  onLayout: (layout: SlideLayout) => void;
  onText: (slot: SlideSlot, blockId: string | null, raw: string) => void;
  onItem: (blockId: string, item: number, raw: string) => void;
};

function BlockField({ block, readOnly, epoch, onText, onItem }: { block: SlideBlock; readOnly: boolean; epoch: number } & Pick<SlideCanvasProps, "onText" | "onItem">) {
  const label = slotLabels[block.slot];
  if (block.type === "image") return <p>{fill(t.imageBlock, { alt: block.alt })}</p>;
  if (block.type === "list") {
    return (
      <>
        {block.items.map((item, index) => (
          <DraftField key={index} label={fill(t.listItemLabel, { slot: label, n: index + 1 })} value={item} multiline={false} readOnly={readOnly} epoch={epoch}
            onChange={(raw) => onItem(block.id, index, raw)} />
        ))}
      </>
    );
  }
  return <DraftField label={label} value={block.text} multiline={block.type === "paragraph"} readOnly={readOnly} epoch={epoch} onChange={(raw) => onText(block.slot, block.id, raw)} />;
}

function Slot({ slide, slot, readOnly, epoch, onText, onItem }: { slide: Slide; slot: SlideSlot; readOnly: boolean; epoch: number } & Pick<SlideCanvasProps, "onText" | "onItem">) {
  const blocks = slide.blocks.filter((block) => block.slot === slot);
  const only = blocks[0];
  const simple = blocks.length === 0 || (blocks.length === 1 && (only!.type === "heading" || only!.type === "paragraph"));
  if (!simple) {
    return <div className={styles.stack}>{blocks.map((block) => <BlockField key={block.id} block={block} readOnly={readOnly} epoch={epoch} onText={onText} onItem={onItem} />)}</div>;
  }
  // An image is only ever placed through an attachment, so an empty image place has no field.
  if (slot === "image") return null;
  const text = only !== undefined && only.type !== "image" && only.type !== "list" ? only.text : "";
  // One element for "empty" and "has its block", so the field keeps focus when the first character creates the block.
  return <DraftField key={`${slide.id}:${slot}`} label={slotLabels[slot]} value={text} multiline={slotBlockType(slot) === "paragraph" && only?.type !== "heading"}
    readOnly={readOnly} epoch={epoch} onChange={(raw) => onText(slot, only?.id ?? null, raw)} />;
}

export function SlideCanvas({ slide, readOnly, epoch, onLayout, onText, onItem }: SlideCanvasProps) {
  const slots = LAYOUT_SLOTS[slide.layout];
  const options = compatibleLayouts(slide).map((layout) => ({ value: layout, label: layoutLabels[layout] }));
  const columns = slots.includes("left");
  const place = (slot: SlideSlot) => <Slot key={slot} slide={slide} slot={slot} readOnly={readOnly} epoch={epoch} onText={onText} onItem={onItem} />;
  return (
    <section className={styles.canvas} aria-label={t.canvasTitle}>
      <Select label={t.layout} hint={t.layoutHint} options={options} value={slide.layout} disabled={readOnly}
        onChange={(event) => onLayout(event.target.value as SlideLayout)} />
      {columns ? (
        <>
          {slots.filter((slot) => slot !== "left" && slot !== "right").map(place)}
          <div className={styles.columns}>{(["left", "right"] as const).map(place)}</div>
        </>
      ) : slots.map(place)}
    </section>
  );
}
