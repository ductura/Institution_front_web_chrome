import type { DeclarationPort } from "../../../../../../src/client/declaration.ts";

/**
 * Until declaration-v1 is on the migration contract extract the host has no server port: every
 * read says „unavailable” and the panel shows that state instead of invented data.
 */
export const unavailableDeclarationPort: DeclarationPort = {
  readStudent: async () => ({ kind: "unavailable" }),
  confirm: async () => ({ kind: "unavailable" }),
  readTeacher: async () => ({ kind: "unavailable" }),
};
