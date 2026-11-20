/** Roving focus of the object toolbar (UI-10A), apart from React so it can be tested without a browser. */

/** The index a key moves to among `count` buttons; null for keys the toolbar does not handle. */
export function toolbarIndex(current: number, count: number, key: string): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowRight": return (current + 1) % count;
    case "ArrowLeft": return (current - 1 + count) % count;
    case "Home": return 0;
    case "End": return count - 1;
    default: return null;
  }
}
