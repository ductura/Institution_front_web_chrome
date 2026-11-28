export const LAYOUTS = ["a", "b", "c"] as const;
export type PanelLayout = (typeof LAYOUTS)[number];
export type MobileLayout = PanelLayout | "same";
export type Side = "left" | "right";
/** ED-37 (P2-6): what a chapter row can show after its title ("U retku poglavlja"). */
export const ROW_PARTS = ["words", "status", "flags"] as const;
export type RowPart = (typeof ROW_PARTS)[number];
/** ED-70 (prototype railcfg "Donji dijelovi"): the left sections a person may hide and reorder, in default order. */
export const LEFT_PARTS = ["figures", "stash", "progress", "deadlines", "thread"] as const;
export type LeftPart = (typeof LEFT_PARTS)[number];
/** ED-70 ("Potpoglavlja"): "open" is the default and kept as no key. */
export const SUB_MODES = ["open", "closed", "active"] as const;
export type SubMode = (typeof SUB_MODES)[number];
/** ED-118 (prototype right.js "Dijelovi panela i redoslijed"): the right panel's groups, in default order. */
export const RIGHT_GROUPS = ["sources", "comments", "review", "work", "assistant"] as const;
export type PanelGroup = (typeof RIGHT_GROUPS)[number];
/**
 * `dense` (ED-39, "Gustoća: Zbijeno") is kept only when chosen; without it the side is "Prozračno".
 * `hideRow` (ED-37) lists the row parts switched off, in ROW_PARTS order; without it the row shows all.
 * `order` (ED-70) is the order of LEFT_PARTS when it differs from the default; `hideParts` the parts
 * switched off, in LEFT_PARTS order; `subs` the "Potpoglavlja" choice other than "open".
 * `scope` (ED-116, right only, "Popisi prvo pokazuju") is kept only as "all"; without it lists open on this chapter.
 * `groups` (ED-118, right only) is the order of RIGHT_GROUPS when it differs from the default; `hideGroups`
 * the groups switched off, in RIGHT_GROUPS order. At least one group always stays shown.
 */
export type LayoutPreferences = Record<Side, {
  layout: PanelLayout; mobile: MobileLayout; dense?: true; hideRow?: RowPart[];
  order?: LeftPart[]; hideParts?: LeftPart[]; subs?: Exclude<SubMode, "open">; scope?: "all";
  groups?: PanelGroup[]; hideGroups?: PanelGroup[];
}>;
/** ED-116: what the comment and review lists of the right panel show first. */
export const LIST_SCOPES = ["chapter", "all"] as const;
export type ListScope = (typeof LIST_SCOPES)[number];

export const DEFAULT_PREFERENCES: LayoutPreferences = {
  left: { layout: "a", mobile: "c" },
  right: { layout: "a", mobile: "same" },
};

export const PREFERENCES_KEY = "ductura.editor.panel-layouts";

export function isPanelLayout(value: unknown): value is PanelLayout {
  return value === "a" || value === "b" || value === "c";
}

function readSide(side: Side, value: unknown): LayoutPreferences[Side] {
  const defaults = DEFAULT_PREFERENCES[side];
  if (typeof value !== "object" || value === null) return defaults;
  const { layout, mobile, dense, hideRow, order, hideParts, subs, scope, groups, hideGroups } = value as Record<string, unknown>;
  const hidden = Array.isArray(hideRow) ? ROW_PARTS.filter((part) => hideRow.includes(part)) : [];
  const off = Array.isArray(hideParts) ? LEFT_PARTS.filter((part) => hideParts.includes(part)) : [];
  const ordered = partOrder({ order: Array.isArray(order) ? order : undefined });
  const groupsOrdered = groupOrder({ groups: Array.isArray(groups) ? groups : undefined });
  const groupsOff = Array.isArray(hideGroups) ? RIGHT_GROUPS.filter((group) => hideGroups.includes(group)) : [];
  return {
    layout: isPanelLayout(layout) ? layout : defaults.layout,
    mobile: mobile === "same" || isPanelLayout(mobile) ? mobile : defaults.mobile,
    ...(dense === true ? { dense: true as const } : {}),
    ...(hidden.length > 0 ? { hideRow: hidden } : {}),
    ...(side === "left" && !isDefaultOrder(ordered) ? { order: ordered } : {}),
    ...(side === "left" && off.length > 0 ? { hideParts: off } : {}),
    ...(side === "left" && (subs === "closed" || subs === "active") ? { subs } : {}),
    ...(side === "right" && scope === "all" ? { scope: "all" as const } : {}),
    ...(side === "right" && !isDefaultGroupOrder(groupsOrdered) ? { groups: groupsOrdered } : {}),
    ...(side === "right" && groupsOff.length > 0 && groupsOff.length < RIGHT_GROUPS.length ? { hideGroups: groupsOff } : {}),
  };
}

/** The side with a "Popisi prvo pokazuju" choice; "chapter" leaves no key. */
export function withScope(value: LayoutPreferences[Side], scope: ListScope): LayoutPreferences[Side] {
  const next = { ...value };
  if (scope === "all") next.scope = "all"; else delete next.scope;
  return next;
}

/** ED-116: true when the person chose that the right panel's lists open on the whole work. */
export function listsStartWholeWork(): boolean {
  return readPreferences().right.scope === "all";
}

const isDefaultOrder = (order: readonly LeftPart[]) => order.every((part, index) => part === LEFT_PARTS[index]);

/** The left parts in the person's order: known parts once each, then any missing ones in default order. */
export function partOrder(value: { order?: readonly unknown[] }): LeftPart[] {
  const known = (value.order ?? []).filter((part, index, all): part is LeftPart =>
    (LEFT_PARTS as readonly unknown[]).includes(part) && all.indexOf(part) === index);
  return [...known, ...LEFT_PARTS.filter((part) => !known.includes(part))];
}

/** The side with one left part moved one place up (-1) or down (1); the default order leaves no key. */
export function withPartMoved(value: LayoutPreferences[Side], part: LeftPart, step: -1 | 1): LayoutPreferences[Side] {
  const order = partOrder(value);
  const from = order.indexOf(part);
  const to = from + step;
  if (from === -1 || to < 0 || to >= order.length) return value;
  [order[from], order[to]] = [order[to]!, order[from]!];
  const next: LayoutPreferences[Side] = { ...value, order };
  if (isDefaultOrder(order)) delete next.order;
  return next;
}

/** The side with one left part shown or hidden; an empty list is dropped. */
export function withPartShown(value: LayoutPreferences[Side], part: LeftPart, shown: boolean): LayoutPreferences[Side] {
  const { hideParts, ...rest } = value;
  const hidden = LEFT_PARTS.filter((p) => (p === part ? !shown : hideParts?.includes(p) ?? false));
  return hidden.length > 0 ? { ...rest, hideParts: hidden } : rest;
}

const isDefaultGroupOrder = (order: readonly PanelGroup[]) => order.every((group, index) => group === RIGHT_GROUPS[index]);

/** ED-118: the right panel's groups in the person's order: known groups once each, then missing ones in default order. */
export function groupOrder(value: { groups?: readonly unknown[] }): PanelGroup[] {
  const known = (value.groups ?? []).filter((group, index, all): group is PanelGroup =>
    (RIGHT_GROUPS as readonly unknown[]).includes(group) && all.indexOf(group) === index);
  return [...known, ...RIGHT_GROUPS.filter((group) => !known.includes(group))];
}

/** ED-118: the groups the right panel shows, in the person's order. */
export function visibleGroups(value: LayoutPreferences[Side]): PanelGroup[] {
  return groupOrder(value).filter((group) => !(value.hideGroups?.includes(group) ?? false));
}

/** The side with one right group moved one place up (-1) or down (1); the default order leaves no key. */
export function withGroupMoved(value: LayoutPreferences[Side], group: PanelGroup, step: -1 | 1): LayoutPreferences[Side] {
  const order = groupOrder(value);
  const from = order.indexOf(group);
  const to = from + step;
  if (from === -1 || to < 0 || to >= order.length) return value;
  [order[from], order[to]] = [order[to]!, order[from]!];
  const next: LayoutPreferences[Side] = { ...value, groups: order };
  if (isDefaultGroupOrder(order)) delete next.groups;
  return next;
}

/** The side with one right group shown or hidden; the last shown group cannot be hidden. */
export function withGroupShown(value: LayoutPreferences[Side], group: PanelGroup, shown: boolean): LayoutPreferences[Side] {
  const { hideGroups, ...rest } = value;
  const hidden = RIGHT_GROUPS.filter((g) => (g === group ? !shown : hideGroups?.includes(g) ?? false));
  if (hidden.length === RIGHT_GROUPS.length) return value;
  return hidden.length > 0 ? { ...rest, hideGroups: hidden } : rest;
}

/** The side with a "Potpoglavlja" choice; "open" leaves no key. */
export function withSubs(value: LayoutPreferences[Side], subs: SubMode): LayoutPreferences[Side] {
  const next = { ...value };
  if (subs === "open") delete next.subs; else next.subs = subs;
  return next;
}

/** The side with one row part switched on or off; an empty list is dropped, so the default stays "show all". */
export function withRowPart(value: LayoutPreferences[Side], part: RowPart, shown: boolean): LayoutPreferences[Side] {
  const { hideRow, ...rest } = value;
  const hidden = ROW_PARTS.filter((p) => (p === part ? !shown : hideRow?.includes(p) ?? false));
  return hidden.length > 0 ? { ...rest, hideRow: hidden } : rest;
}

/** What a chapter row shows under these preferences. */
export function rowShows(value: LayoutPreferences[Side]): Record<RowPart, boolean> {
  const off = (part: RowPart) => value.hideRow?.includes(part) ?? false;
  return { words: !off("words"), status: !off("status"), flags: !off("flags") };
}

export function readPreferences(): LayoutPreferences {
  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    if (raw === null) return DEFAULT_PREFERENCES;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return DEFAULT_PREFERENCES;
    const { left, right } = value as Record<string, unknown>;
    return { left: readSide("left", left), right: readSide("right", right) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function writePreferences(value: LayoutPreferences): void {
  try {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(value));
  } catch {
    // Settings stay usable in memory when the browser denies storage.
  }
}

export function effectiveLayout(preference: LayoutPreferences[Side], phone: boolean): PanelLayout {
  return phone && preference.mobile !== "same" ? preference.mobile : preference.layout;
}
