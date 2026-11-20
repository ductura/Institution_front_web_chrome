// Generated subset of Institution_server a62e0db (API 1.24.0).
// WEB-07: remove this supplement when the migration contracts are published.
export type MigrationOperations = {
  "institution.admin-courses.post": {
    params: undefined;
    query: undefined;
    body: { "name": string; "academicYear": string; "aiPolicy": "prohibited" | "partially_allowed" | "encouraged"; "holderId": string; "groups": (string)[] };
    success: { status: 200; body: { "id": string; "groups": ({ "id": string; "name": string })[] }; headers: {  } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "invalid_input" | "unsupported_media_type" | "invalid_json" | "forbidden" | "unavailable" | "conflict";
  };
  "institution.course-assignments.post": {
    params: { "courseId": string };
    query: undefined;
    body: { "requestKey": string; "title": string; "instructions": string; "workType": "short_paper" | "essay" | "seminar_paper" | "bachelor_thesis" | "master_thesis" | "specialist_thesis" | "doctoral_thesis"; "opensAt": string; "dueAt": string; "aiPolicy": "prohibited" | "partially_allowed" | "encouraged"; "aiPurposes": ("formatting" | "proofreading" | "literature_search" | "transcription" | "translation")[]; "evidenceProfile": "basic" | "extended"; "importAllowed": boolean; "wordMin": number | null; "wordMax": number | null };
    success: { status: 201; body: { "id": string }; headers: {  } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "invalid_input" | "unsupported_media_type" | "invalid_json" | "forbidden" | "unavailable" | "conflict";
  };
  "institution.course-group-teachers.post": {
    params: { "groupId": string };
    query: undefined;
    body: { "teacherId": string };
    success: { status: 200; body: { "assigned": boolean }; headers: {  } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "invalid_input" | "unsupported_media_type" | "invalid_json" | "forbidden" | "unavailable";
  };
  "institution.course-groups.get": {
    params: { "courseId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "groups": ({ "id": string; "name": string; "teachers": ({ "id": string; "givenName": string; "familyName": string })[]; "students": number })[] }; headers: {  } };
    errorCode: "unauthorized" | "invalid_input" | "forbidden" | "unavailable";
  };
  "institution.course-groups.post": {
    params: { "courseId": string };
    query: undefined;
    body: { "name": string };
    success: { status: 200; body: { "id": string }; headers: {  } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "invalid_input" | "unsupported_media_type" | "invalid_json" | "forbidden" | "unavailable";
  };
  "profile.me.get": {
    params: undefined;
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "institution": { "slug": string; "displayName": string | null }; "roles": ("student" | "teacher" | "network_engineer" | "institution_admin")[]; "displayName": string | null }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "unavailable";
  };
  // Institution_server 8772012 (SRV-9B).
  "public.verification.post": {
    params: undefined;
    query: undefined;
    body: { "submissionId": string; "artifactSha256": string };
    success: { status: 200; body: { "match": true; "submittedAt": string; "signedAt": string; "keyId": string } | { "match": false }; headers: {  } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unsupported_media_type" | "invalid_json" | "invalid_input" | "unavailable";
  };
  "student.assignments.get": {
    params: undefined;
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "courses": ({ "id": string; "name": string; "academicYear"?: string; "groups"?: ({ "id": string; "name": string })[]; "teachers"?: ({ "id": string; "givenName": string; "familyName": string; "role": "holder" | "collaborator" })[]; "assignments": ({ "id": string; "title": string; "dueAt": string; "noticeFirst": boolean; "workType"?: "short_paper" | "essay" | "seminar_paper" | "bachelor_thesis" | "master_thesis" | "specialist_thesis" | "doctoral_thesis"; "mentor"?: { "id": string; "givenName": string; "familyName": string } | null; "extendedDueAt"?: string | null })[] })[] }; headers: {  } };
    errorCode: "unauthorized" | "unavailable";
  };
  "student.enrollments.post": {
    params: undefined;
    query: undefined;
    body: { "code": string };
    success: { status: 200; body: { "outcome": "enrolled" | "already_enrolled" | "enrolled_no_assignment"; "courseId": string }; headers: {  } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "unsupported_media_type" | "invalid_json" | "invalid_input" | "invalid_code" | "expired_code" | "too_many_attempts" | "forbidden" | "unavailable";
  };
  "student.notice-read.post": {
    params: { "assignmentId": string };
    query: undefined;
    body: { "versionNo": number };
    success: { status: 200; body: { "readAt": string }; headers: {  } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "invalid_assignment_id" | "unauthorized" | "unsupported_media_type" | "invalid_json" | "invalid_input" | "not_found" | "conflict" | "unavailable";
  };
  // SRV-27 / SRV-1108 (Institution_server API 1.35.0), added for WEB-1113.
  "teacher.assignment-overview.get": {
    params: { "assignmentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "students": ({ "studentId": string; "givenName": string | null; "familyName": string | null; "groupName": string | null; "submitted": boolean; "requestedMinute": string | null; "afterDeadline": boolean | null; "evidenceRecord": "continuous" | "with_gaps" | null })[] }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "unavailable";
  };
  "teacher.deadline-extensions.get": {
    params: { "assignmentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "extensions": ({ "id": string; "scope": "one" | "all"; "studentId": string | null; "previousDueAt": string; "dueAt": string; "reasonId": "justified" | "technical" | "agreement" | "all" | null; "createdBy": string; "createdAt": string })[] }; headers: {  } };
    errorCode: "unauthorized" | "not_found" | "unavailable";
  };
  "teacher.deadline-extension.post": {
    params: { "assignmentId": string };
    query: undefined;
    body: { "scope": "one"; "studentId": string; "dueAt": string; "reasonId": "justified" | "technical" | "agreement" } | { "scope": "all"; "dueAt": string; "reasonId": "justified" | "technical" | "agreement" | "all" };
    success: { status: 201; body: { "extension": { "id": string; "scope": "one" | "all"; "studentId": string | null; "previousDueAt": string; "dueAt": string; "reasonId": "justified" | "technical" | "agreement" | "all" | null; "createdBy": string; "createdAt": string }; "existingSubmissionsUnchanged": boolean }; headers: {  } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "unsupported_media_type" | "invalid_json" | "invalid_input" | "not_found" | "unavailable";
  };
  // Institution_server d1a30f2 (SRV-1105 and SRV-9A).
  "work.consultation-additions.post": {
    params: { "documentId": string; "recordId": string };
    query: undefined;
    body: { "text": string };
    success: { status: 201; body: { "id": string; "text": string; "createdAt": string }; headers: {  } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "unsupported_media_type" | "invalid_json" | "invalid_input" | "not_found" | "unavailable";
  };
  "work.consultation-records.get": {
    params: { "documentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "records": ({ "id": string; "heldOn": string; "revision": number; "topic": string; "agreement": string; "additions": ({ "id": string; "text": string; "createdAt": string })[] })[] }; headers: {  } };
    errorCode: "unauthorized" | "not_found" | "unavailable";
  };
  "work.consultation-records.post": {
    params: { "documentId": string };
    query: undefined;
    body: { "heldOn": string; "revision": number; "topic": string; "agreement": string };
    success: { status: 201; body: { "id": string; "heldOn": string; "revision": number; "topic": string; "agreement": string; "additions": ({ "id": string; "text": string; "createdAt": string })[] }; headers: {  } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "unsupported_media_type" | "invalid_json" | "invalid_input" | "not_found" | "unavailable";
  };
  "work.versions.get": {
    params: { "documentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "versions": ({ "kind": "submission"; "revision": number; "savedMinute": string; "afterDeadline": boolean } | { "kind": "checkpoint"; "revision": number; "savedMinute": string })[]; "nextBeforeRevision": number | null }; headers: {  } };
    errorCode: "unauthorized" | "not_found" | "invalid_input" | "unavailable";
  };
  // Institution_server 46e4aad (SRV-NG).
  "student.notice.get": {
    params: { "assignmentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "assignmentId": string; "versionNo": number; "templateVersion": number; "title": string; "instructions": string; "workType": "short_paper" | "essay" | "seminar_paper" | "bachelor_thesis" | "master_thesis" | "specialist_thesis" | "doctoral_thesis"; "opensAt": string; "dueAt": string; "aiPolicy": "prohibited" | "partially_allowed" | "encouraged"; "aiPurposes": ("formatting" | "proofreading" | "literature_search" | "transcription" | "translation")[]; "evidenceProfile": "basic" | "extended"; "wordMin": number | null; "wordMax": number | null; "readAt": string | null; "acknowledgedAt": string | null }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "not_found" | "unavailable";
  };
};
