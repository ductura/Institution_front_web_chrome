import "@ductura/ui/fonts.css";
import "@ductura/ui/tokens.css";

import { createRoot } from "react-dom/client";

import { CATALOG_STATES } from "./coverage";
import { ENTRIES, SCREEN_ENTRIES } from "./entries";
import styles from "./Catalog.module.css";
import { DeclarationFlow } from "./declaration-flow";

// A screen (src/components) is the shell itself, so it shows only on the shell;
// the white sheet sits inside a screen, never around it (DAN-753).
// ?theme=light shows the light shell; anything else is the dark default (D-188).
// Parts of the shell's own panels sit on --chrome and never on the sheet (WEB-06).
const SHELL_ONLY = new Set(["PanelTabs"]);
const shellOnly = (name: string) => name in SCREEN_ENTRIES || SHELL_ONLY.has(name);

const theme = new URLSearchParams(location.search).get("theme") === "light" ? "light" : "dark";
document.documentElement.setAttribute("data-theme", theme);

function Catalog() {
  return (
    <main className={styles.page}>
      <h1>Katalog komponenti</h1>
      {[...Object.entries(ENTRIES), ...Object.entries(SCREEN_ENTRIES)].map(([name, states]) => (
        <section key={name} id={name} aria-labelledby={`${name}-h`} className={styles.component}>
          <h2 id={`${name}-h`}>{name}</h2>
          {(shellOnly(name) ? ["ljuska"] as const : ["ljuska", "list"] as const).map((surface) => (
            <div key={surface} className={surface === "list" ? `sheet ${styles.sheet}` : styles.shell}
              data-sheet-theme={surface === "list" ? "light" : undefined}>
              <p className={styles.surface}>{surface === "list" ? "Bijeli list" : "Ljuska"}</p>
              <dl className={name in SCREEN_ENTRIES ? `${styles.states} ${styles.screens}` : styles.states}>
                {CATALOG_STATES.map((state) => (
                  <div key={state} className={styles.state}>
                    <dt>{state}</dt>
                    <dd>{states[state]()}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </section>
      ))}
      <DeclarationFlow />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Catalog />);
