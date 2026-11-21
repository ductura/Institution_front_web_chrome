/** A click on the scrim lands outside the drawer's own box; one on its empty space lands inside it. */
export function isBackdropClick(x: number, y: number, box: { left: number; right: number; top: number; bottom: number }): boolean {
  return x < box.left || x > box.right || y < box.top || y > box.bottom;
}
