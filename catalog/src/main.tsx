import "@ductura/ui/fonts.css";
import "@ductura/ui/tokens.css";

import { createRoot } from "react-dom/client";

import { CATALOG_STATES } from "./coverage";
import { ENTRIES } from "./entries";
import styles from "./Catalog.module.css";

// ?theme=light shows the light shell; anything else is the dark default (D-188).
const theme = new URLSearchParams(location.search).get("theme") === "light" ? "light" : "dark";
document.documentElement.setAttribute("data-theme", theme);

function Catalog() {
  return (
    <main className={styles.page}>
      <h1>Katalog komponenti</h1>
      {Object.entries(ENTRIES).map(([name, states]) => (
        <section key={name} id={name} aria-labelledby={`${name}-h`} className={styles.component}>
          <h2 id={`${name}-h`}>{name}</h2>
          {(["ljuska", "list"] as const).map((surface) => (
            <div key={surface} className={surface === "list" ? `sheet ${styles.sheet}` : styles.shell}
              data-sheet-theme={surface === "list" ? "light" : undefined}>
              <p className={styles.surface}>{surface === "list" ? "Bijeli list" : "Ljuska"}</p>
              <dl className={styles.states}>
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
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Catalog />);
