import type { ReactNode, SVGProps } from "react";

/**
 * Icons of the editor toolbar (WEB-03, for WEB-15; editor prototype E§3.6
 * toolbar2): undo, redo, block style, bold, italic, bullet list and quote,
 * plus the chevron of a menu. Drawn on a 16 px grid with a 1.5 px stroke in
 * currentColor, so they take the ink of the button they sit in. Always
 * decorative: the button carries the name (aria-label), never the icon.
 */
const DOT = { fill: "currentColor", r: 0.75 } as const;

const PATHS = {
  undo: <path d="M5.5 3.5 2.5 6.5l3 3M2.5 6.5H10a3.5 3.5 0 0 1 0 7H7" />,
  redo: <path d="m10.5 3.5 3 3-3 3M13.5 6.5H6a3.5 3.5 0 0 0 0 7h3" />,
  paragraph: <path d="M7 13.5v-11M10.5 13.5v-11M12.5 2.5H6.25a3 3 0 0 0 0 6H7" />,
  heading: <path d="M3.5 2.5v11M12.5 2.5v11M3.5 8h9" />,
  bold: <path d="M4.5 2.5h4.25a2.75 2.75 0 0 1 0 5.5H4.5zM4.5 8h5a2.75 2.75 0 0 1 0 5.5h-5z" />,
  italic: <path d="M7 2.5h5M4 13.5h5M10 2.5l-4 11" />,
  bulletList: (
    <>
      <path d="M6.5 4h7M6.5 8h7M6.5 12h7" />
      <circle cx="3" cy="4" {...DOT} />
      <circle cx="3" cy="8" {...DOT} />
      <circle cx="3" cy="12" {...DOT} />
    </>
  ),
  numberedList: (
    <>
      <path d="M7.5 4h6M7.5 8h6M7.5 12h6M2.5 3l1-.5v3M2.5 7.25h2l-2 2.25h2M2.5 11.5h1.75l-1 1 1 1H2.5" />
    </>
  ),
  quote: <path d="M3 3v10M6.5 4.5h6.5M6.5 8h6.5M6.5 11.5h4" />,
  chevronDown: <path d="m4 6 4 4 4-4" />,
} as const satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

/** Every icon, in toolbar order. */
export const ICON_NAMES = Object.keys(PATHS) as readonly IconName[];

export type IconProps = Omit<SVGProps<SVGSVGElement>, "children" | "viewBox"> & { name: IconName; size?: number };

export function Icon({ name, size = 16, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
      aria-hidden="true"
      focusable="false"
    >
      {Object.hasOwn(PATHS, name) ? PATHS[name] : null}
    </svg>
  );
}
