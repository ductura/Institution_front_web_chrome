import FacultySettingsRoute from "../../../../../src/host/admin/faculty-settings/routes";

/** NF-7 OA-9: the faculty's assistant settings, read only. */
export default function Page() {
  return <FacultySettingsRoute view="assistant" />;
}
