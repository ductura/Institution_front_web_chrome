import type { ReactNode } from "react";

/**
 * A link of the prototype's panels (`<a href>`). Without `onClick` it is an ordinary link; with one, a plain
 * click does that instead of following the address (an action written as a link, e.g. "Dodaj napomenu").
 */
export default function StepLink({ href, children, onClick, ...rest }: {
  href: string; children: ReactNode; onClick?: () => void; "aria-expanded"?: boolean; "aria-controls"?: string; "aria-disabled"?: boolean; id?: string;
}) {
  return (
    <a {...rest} href={href} onClick={onClick ? (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      onClick();
    } : undefined}>{children}</a>
  );
}
