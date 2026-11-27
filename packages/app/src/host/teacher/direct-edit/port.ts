// The teacher's side of the direct-edit setting (WEB-1703; PM2-R04). The setting is read through
// the student's real port (work.direct-edit.get). TODO(ugovor): the server has no route that
// writes the teacher's text (the record holds only `teacher_edit` with a byte count), so
// submitEdit never calls the network and answers `rejected`; the field stays closed through
// `writable: false` in TeacherDirectEdit. No route is invented (F4 decision).
import type { ApiOptions } from "@/client/api";
import { directEditPort } from "../../student/direct-edit-setting/port";
import type { TeacherEditPort } from "./model";

export const TEACHER_EDIT_WRITABLE = false;

export function teacherEditPort(options?: ApiOptions): TeacherEditPort {
  return { ...directEditPort(options), submitEdit: async () => ({ kind: "rejected" }) };
}
