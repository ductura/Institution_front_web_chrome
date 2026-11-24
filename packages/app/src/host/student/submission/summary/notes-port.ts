// The notes of the submission (student.submission-notes.get and .post) over the client: one transport for
// the page's life, shared by step 3 (PD-4) and the note beside a submitted declaration (NF-3 PR-14, E-9b).
import { createApi } from "../../../../../../../src/client/api.ts";

import { notesCall, type ClientAnswer, type NotesClient } from "./model";

const client: NotesClient = {
  list: (assignmentId) => createApi()("student.submission-notes.get", { params: { assignmentId }, query: undefined, body: undefined }) as Promise<ClientAnswer>,
  add: (assignmentId, text) => createApi()("student.submission-notes.post", { params: undefined, query: undefined, body: { assignmentId, text } }) as Promise<ClientAnswer>,
};

export const NOTES = notesCall(client);
