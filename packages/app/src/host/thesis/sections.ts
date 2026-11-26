// WEB-V16-KOSTUR: the registry of the panel's sections. The app runs on Next.js, which has no
// `import.meta.glob` (Vite only), so each later task adds ONE import line and ONE array entry here:
//   import { section as forms } from "./forms/section";   …   [forms as unknown as ThesisSectionDef<never>]
// Each `section.tsx` exports `section` (see ThesisSectionDef in model.ts).
import { section as stagesStudent } from "./stages-student/section";
import { section as forms } from "./forms/section";
import { orderSections, type ThesisSectionDef } from "./model";
import { section as stage } from "./stage/section";
import { section as topicMentor } from "./topic-mentor/section";
import { section as topicStudent } from "./topic-student/section";

const modules: readonly ThesisSectionDef<never>[] = [
  // The registry holds sections of any value type; `never` is the frame's erased form (model.ts).
  forms as unknown as ThesisSectionDef<never>,
  stage as unknown as ThesisSectionDef<never>,
  stagesStudent as unknown as ThesisSectionDef<never>,
  topicMentor as unknown as ThesisSectionDef<never>,
  topicStudent as unknown as ThesisSectionDef<never>,
];

export const registeredSections: readonly ThesisSectionDef<never>[] = orderSections(modules);
