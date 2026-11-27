import { FastPathLive } from "@/components/teacher/FastPath";
import { messagesHr as t } from "@/lib/i18n/messages.hr";

import styles from "./page.module.css";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata = { title: `${t.fastPath.title}, ${t.app.name}` };

export default async function FastPathPage({ searchParams }: { searchParams: Promise<{ zadatak?: string | string[] }> }) {
  const { zadatak } = await searchParams;
  const assignmentId = typeof zadatak === "string" && UUID.test(zadatak) ? zadatak.toLowerCase() : null;
  return (
    <div className={`page ${styles.page}`}>
      <h1>{t.fastPath.title}</h1>
      <p className={styles.intro}>{t.fastPath.intro}</p>
      <FastPathLive assignmentId={assignmentId} />
    </div>
  );
}
