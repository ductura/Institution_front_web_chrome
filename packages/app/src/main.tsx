import "@ductura/ui/fonts.css";
import "@ductura/ui/tokens.css";

import { readTheme } from "@ductura/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import ErrorBoundary from "./ErrorBoundary";
import { baseOf } from "./routes";

// The kept theme, dark by default (D-188); storage may be blocked.
let storage: Storage | undefined;
try {
  storage = window.localStorage;
} catch {
  storage = undefined;
}
document.documentElement.setAttribute("data-theme", readTheme(storage));

const root = document.getElementById("root");
if (root !== null) {
  createRoot(root).render(
    <StrictMode>
      {/* DAN-1568: a screen that throws while it renders leaves the error screen, not an empty page. */}
      <ErrorBoundary>
        <App base={baseOf(window.location.pathname)} />
      </ErrorBoundary>
    </StrictMode>,
  );
}
