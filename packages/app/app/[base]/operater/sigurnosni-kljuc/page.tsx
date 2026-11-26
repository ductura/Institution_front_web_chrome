import SecurityKeyPage from "../../../../src/host/operator/webauthn/SecurityKeyPage";

/** F4-PM2-R16: the security key confirmation; the host opens it only for the operator account (src/routes.ts). */
export default function Page() {
  return <SecurityKeyPage />;
}
