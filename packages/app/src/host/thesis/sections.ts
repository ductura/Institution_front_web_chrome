// WEB-V16-KOSTUR: the registry of the panel's sections. Each later task adds `host/thesis/<name>/section.tsx`
// exporting `section`; nothing is edited here. If the glob ever fails lint or the build, the fallback is one
// import line per task in this file.
import { orderSections, sectionOf, type ThesisSectionDef } from "./model";

const modules = import.meta.glob("./*/section.tsx", { eager: true });

export const registeredSections: readonly ThesisSectionDef<never>[] = orderSections(
  Object.values(modules).map(sectionOf).filter((s): s is ThesisSectionDef<never> => s !== null),
);
