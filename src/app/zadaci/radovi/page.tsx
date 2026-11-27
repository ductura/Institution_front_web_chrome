import { headers } from "next/headers";

import { serverApi } from "../../../client/server";
import RoleShell, { signInPage } from "../../../components/shell/RoleShell";
import MyWorks from "../../../components/student/radovi/MyWorks";
import { readMyWorks } from "../../../components/student/radovi/works-read";
import { paramOf } from "../../../components/student/radovi/works-view";
import { messagesHr as t } from "../../../lib/i18n/messages.hr";

// The session cookie is read per request: nothing of a student's list is built in.
export const dynamic = "force-dynamic";
export const metadata = { title: `${t.student.works.title}, ${t.app.name}` };

const HERE = "/zadaci/radovi";

/** The Next route of a work (WEB-14); it sends an unacknowledged notice first. */
const workHref = (assignmentId: string) => `/rad/${encodeURIComponent(assignmentId)}`;

type Params = Promise<Record<string, string | string[] | undefined>>;

/** The reads, asked only once RoleShell found a session with a role. */
async function Works({ searchParams }: { searchParams: Params }) {
  // The Cookie header as the browser sent it: re-serialising the cookies could alter a value.
  const cookie = (await headers()).get("cookie") ?? "";
  const params = await searchParams;
  const read = await readMyWorks(serverApi(cookie));
  return (
    <MyWorks read={read} filter={{ q: paramOf(params.q), year: paramOf(params.godina) }}
      here={HERE} signIn={signInPage} workHref={workHref} />
  );
}

/**
 * S: E-4 "Moji radovi" (WEB-10, A-10): the student's works across courses,
 * with a search and an academic year (`?q=`, `?godina=`), which only narrow
 * what the reads returned. Through src/client with the request's cookie.
 */
export default function MyWorksPage({ searchParams }: { searchParams: Params }) {
  return (
    <RoleShell here={HERE} current={HERE} crumbs={[t.student.works.title]}>
      <Works searchParams={searchParams} />
    </RoleShell>
  );
}
