// Generated subset of Institution_server a62e0db (API 1.24.0).
// WEB-07: remove this supplement when the migration contracts are published.
// HOST-T2: institution.assignment.get from API 1.38.0; the work-language GET is provisional.
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
  // Institution_server a362c63 (SRV-JS, SRV-ST).
  "profile.me.get": {
    params: undefined;
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "institution": { "slug": string; "displayName": string | null }; "roles": ("student" | "teacher" | "network_engineer" | "institution_admin")[]; "displayName": string | null; "journalScope": string; "sessionTag": string }; headers: {  } };
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
  "institution.assignment.get": {
    params: { "assignmentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "assignmentId": string; "courseId": string; "versionNo": number; "title": string; "instructions": string; "workType": "short_paper" | "essay" | "seminar_paper" | "bachelor_thesis" | "master_thesis" | "specialist_thesis" | "doctoral_thesis"; "opensAt": string; "dueAt": string; "aiPolicy": "prohibited" | "partially_allowed" | "encouraged"; "aiPurposes": ("formatting" | "proofreading" | "literature_search" | "transcription" | "translation")[]; "evidenceProfile": "basic" | "extended"; "importAllowed": boolean; "wordMin": number | null; "wordMax": number | null; "groupIds"?: (string)[]; "externalToolsAllowed"?: boolean; "aiSummaryOnly"?: boolean }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "invalid_input" | "not_found" | "unavailable";
  };
  "institution.work-work-language.get": {
    params: { "assignmentId": string; "documentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "title": string; "assignmentLanguage": "hr" | "en"; "exception": "hr" | "en" | null }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "invalid_input" | "not_found" | "unavailable";
  };
  // Institution_server 46e4aad (SRV-NG).
  "student.notice.get": {
    params: { "assignmentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "assignmentId": string; "versionNo": number; "templateVersion": number; "title": string; "instructions": string; "workType": "short_paper" | "essay" | "seminar_paper" | "bachelor_thesis" | "master_thesis" | "specialist_thesis" | "doctoral_thesis"; "opensAt": string; "dueAt": string; "aiPolicy": "prohibited" | "partially_allowed" | "encouraged"; "aiPurposes": ("formatting" | "proofreading" | "literature_search" | "transcription" | "translation")[]; "evidenceProfile": "basic" | "extended"; "wordMin": number | null; "wordMax": number | null; "readAt": string | null; "acknowledgedAt": string | null }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "not_found" | "unavailable";
  };
  // Institution_server aab566c (SRV-1103).
  "work.milestones.get": {
    params: { "documentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "milestones": ({ "id": string; "title": string; "description": string; "dueAt": string | null; "state": "open" | "submitted" | "approved" | "returned" })[] }; headers: {  } };
    errorCode: "unauthorized" | "not_found" | "unavailable";
  };
  "work.milestones.patch": {
    params: { "documentId": string; "milestoneId": string };
    query: undefined;
    body: { "dueAt": string };
    success: { status: 200; body: { "id": string; "title": string; "description": string; "dueAt": string | null; "state": "open" | "submitted" | "approved" | "returned" }; headers: {  } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "not_found" | "unavailable" | "invalid_json" | "forbidden" | "conflict" | "unsupported_media_type" | "invalid_input";
  };
  // Institution_server a56b7a5 (SRV-1106).
  "work.messages.get": {
    params: { "documentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "messages": ({ "id": string; "senderRole": "student" | "teacher"; "text": string; "createdAt": string })[] }; headers: {  } };
    errorCode: "unauthorized" | "not_found" | "unavailable";
  };
  "work.messages.post": {
    params: { "documentId": string };
    query: undefined;
    body: { "text": string };
    success: { status: 201; body: { "id": string; "senderRole": "student" | "teacher"; "text": string; "createdAt": string }; headers: {  } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "unsupported_media_type" | "invalid_json" | "invalid_input" | "not_found" | "unavailable";
  };
  // Institution_server a362c63 (SRV-30).
  "teacher.submission-receipt.get": {
    params: { "assignmentId": string; "studentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "state": "none" } | { "state": "ceka"; "revision": number; "requestedAt": string } | { "state": "potvrdeno"; "receipt": { "payload": { "receiptSchema": "ductus-submission-receipt-v2"; "submissionId": string; "evidenceDomainId": string; "principalId": string; "assignmentId": string; "assignmentVersion": number; "documentId": string; "evidencePackageId": string; "revision": number; "artifactSha256": string; "evidenceHeadSegmentHash": string; "evidenceRecord": "continuous" | "with_gaps"; "requestedAt": string; "dueAt": string; "afterDeadline": boolean; "signedAt": string }; "payloadDigestSha256": string; "signature": { "algorithm": "Ed25519"; "keyId": string; "keyVersion": string; "signatureEncoding": "raw"; "signatureBase64Url": string } } }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "not_found" | "unavailable";
  };
  // TODO(ugovor): the read agreed in Ductus#2028 c.7024185874.
  "teacher.work.get": {
    params: { "documentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "documentId": string; "studentId": string; "studentName": string | null; "assignmentId": string; "state": "predano" | "nije_predano" | "nakon_roka" | "ceka"; "prevDocumentId": string | null; "nextDocumentId": string | null }; headers: {  } };
    errorCode: "unauthorized" | "not_found" | "unavailable";
  };
  // Institution_server 10ae097 (SRV-1109 and SRV-1110): Merlin roster, CSV, package and download.
  "teacher.merlin-roster.get": {
    params: { "assignmentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "rows": ({ "familyName": string; "givenName": string; "submitted": false; "submittedMinute": null; "afterDeadline": null; "pdfName": null; "pdfSha256": null; "docxName": null; "docxSha256": null } | { "familyName": string; "givenName": string; "submitted": true; "submittedMinute": string; "afterDeadline": boolean; "pdfName": string; "pdfSha256": string; "docxName": string; "docxSha256": string } | { "familyName": null; "givenName": null; "submitted": false; "submittedMinute": null; "afterDeadline": null; "pdfName": null; "pdfSha256": null; "docxName": null; "docxSha256": null } | { "familyName": null; "givenName": null; "submitted": true; "submittedMinute": string; "afterDeadline": boolean; "pdfName": string; "pdfSha256": string; "docxName": string; "docxSha256": string })[]; "extensionReasons": ({ "studentId": string | null; "dueAt": string; "reasonId": "justified" | "technical" | "agreement" | "all" })[] }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "not_found" | "unavailable";
  };
  "teacher.merlin-roster-csv.get": {
    params: { "assignmentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: undefined; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "not_found" | "unavailable";
  };
  "teacher.merlin-packages.post": {
    params: { "assignmentId": string };
    query: undefined;
    body: { "requestKey": string };
    success: { status: 202; body: { "id": string; "state": "queued" | "ready" | "failed" | "expired" }; headers: {  } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "unsupported_media_type" | "invalid_json" | "invalid_input" | "not_found" | "unavailable";
  };
  "teacher.merlin-package.get": {
    params: { "assignmentId": string; "packageId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "id": string; "state": "queued" | "failed" } | { "id": string; "state": "ready"; "downloadPath": string; "expiresAt": string; "sha256": string } | { "id": string; "state": "expired"; "expiresAt": string; "sha256": string }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "not_found" | "unavailable";
  };
  "teacher.merlin-package-download.get": {
    params: { "assignmentId": string; "packageId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: undefined; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "not_found" | "unavailable" | "conflict" | "not_allowed";
  };
};
