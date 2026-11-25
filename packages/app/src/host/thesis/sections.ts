// WEB-V16-KOSTUR: the registry of the panel's sections. The app runs on Next.js, which has no
// `import.meta.glob` (Vite only), so each later task adds ONE import line and ONE array entry here:
//   import { section as forms } from "./forms/section";   …   [forms]
// Each `section.tsx` exports `section` (see ThesisSectionDef in model.ts).
import { section as stagesStudent } from "./stages-student/section";
import { orderSections, type ThesisSectionDef } from "./model";

const modules: readonly ThesisSectionDef<never>[] = [stagesStudent as unknown as ThesisSectionDef<never>]; // each section is typed by its own value; the frame reads it as never

export const registeredSections: readonly ThesisSectionDef<never>[] = orderSections(modules);
