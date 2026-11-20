import { createRoot } from "react-dom/client";
import "@ductura/ui/tokens.css";

import { WorkMentorSections } from "../../milestones/WorkMentorSections";

const params = new URLSearchParams(window.location.search);
const role = params.get("role") === "teacher" ? "teacher" : "student";

createRoot(document.getElementById("app")!).render(
  <WorkMentorSections documentId="demo-work" role={role} current={() => true} mayEditDue={!params.has("submitted")} />,
);
