import type { SVGProps } from "react";

/**
 * The Ductura mark: the letter D as two overlapping strokes, a stem and a
 * bowl, with a light edge like a sticker. The colours belong to the mark and
 * do not follow the theme.
 */
export function Mark(props: Omit<SVGProps<SVGSVGElement>, "viewBox" | "children">) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false" {...props}>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M38 22 V98" stroke="#faf9f5" strokeWidth="40" />
        <path d="M38 22 C104 22 104 98 38 98" stroke="#faf9f5" strokeWidth="40" />
        <path d="M38 22 C104 22 104 98 38 98" stroke="#c8aa6e" strokeWidth="24" />
        <path d="M38 22 V98" stroke="#8fb0e0" strokeWidth="24" />
        <path d="M38 22 V48" stroke="#8fb0e0" strokeWidth="24" />
        <path d="M38 98 C60 98 76 94 86 84" stroke="#c8aa6e" strokeWidth="24" opacity=".85" />
      </g>
    </svg>
  );
}
