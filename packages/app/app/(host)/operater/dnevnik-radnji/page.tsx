import ActionLogPage from "../../../../src/host/operator/action-log/ActionLogPage";

/** NF-7 OA-3: the log of actions; the host opens it only for the operator's and the administrator's accounts (src/routes.ts). */
export default function Page() {
  return <ActionLogPage />;
}
