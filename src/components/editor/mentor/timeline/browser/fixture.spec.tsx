import { createRoot } from "react-dom/client";
import "@ductura/ui/tokens.css";
import { MentorWorkState } from "../../work-state/MentorWorkState";

const role = new URLSearchParams(window.location.search).get("role") === "teacher" ? "teacher" : "student";
createRoot(document.getElementById("app")!).render(
  <MentorWorkState documentId="demo-work" role={role} submitted={role === "student" ? false : undefined} />,
);
