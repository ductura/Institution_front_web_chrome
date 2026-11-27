/**
 * WEB-DIZ-S-ZAJEDNICKO (Ductus#2059 c.7214951129, A4): the browser tab's title, "{naslov}, {aplikacija}",
 * with a comma and a space instead of "·". No heading leaves the app's name alone.
 */
export function documentTitle(heading: string | null | undefined, appName: string): string {
  const text = heading?.trim() ?? "";
  return text === "" ? appName : `${text}, ${appName}`;
}
