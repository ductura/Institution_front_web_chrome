import { createApi, type ApiResult } from "./api";

type Messages = Extract<ApiResult<"work.messages.get">, { ok: true }>["body"]["messages"];
export type WorkMessage = Messages[number];

export async function readWorkMessages(documentId: string, api = createApi()) {
  return api("work.messages.get", { params: { documentId }, query: undefined, body: undefined });
}

export async function sendWorkMessage(documentId: string, text: string, api = createApi()) {
  return api("work.messages.post", { params: { documentId }, query: undefined, body: { text } });
}
