import HealthPage from "../../../../src/host/operator/health/HealthPage";

/** F4-PM2-R16: the system state; the host opens it only for the operator account (src/routes.ts). */
export default function Page() {
  return <HealthPage />;
}
