import { PilotMetrics } from "../../../../src/host/operator/pilot-metrics/PilotMetrics";

/**
 * WEB-NUZ-OPERATER (NF-7 OA-1): the operator's page, inside the host. The host reads the session
 * and opens it only for the operator's account (src/routes.ts OPERATOR_HOME); everyone else is refused.
 */
export default function Page() {
  return <PilotMetrics />;
}
