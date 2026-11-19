// WEB-02 (Ductus#2028 c.7008147932): every request under SERVER_PREFIX
// (src/client/api.ts) goes on to Institution_server, sign-in and sign-out
// included. A more specific route than the catch-all 404 one level up, so it wins.
import { forwardRequest } from "../../../../client/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = forwardRequest;
export const HEAD = forwardRequest;
export const POST = forwardRequest;
export const PUT = forwardRequest;
export const PATCH = forwardRequest;
export const DELETE = forwardRequest;
export const OPTIONS = forwardRequest;
