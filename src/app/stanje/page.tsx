import { connection } from "next/server";

import AppHeader from "@/components/shell/AppHeader";
import ThemeRestore from "@/components/shell/ThemeRestore";
import StatusBoard from "@/components/status/StatusBoard";
import styles from "@/components/status/Status.module.css";
import { messagesHr as t } from "@/lib/i18n/messages.hr";

export const metadata = { title: `${t.statusPage.pageTitle}, ${t.app.name}` };

// DAN-429: public, no session read. Rendered per request so the CSP nonce is set (DAN-489).
export default async function StatusPage() {
  await connection();
  return (
    <>
      <ThemeRestore />
      <AppHeader />
      <main id="sadrzaj" tabIndex={-1} className={`page ${styles.statusPage}`}>
        <h1>{t.statusPage.title}</h1>
        <p>{t.statusPage.intro}</p>
        <StatusBoard />
      </main>
    </>
  );
}
