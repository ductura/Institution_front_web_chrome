// Generated subset of Institution_server a62e0db (API 1.24.0).
// WEB-07: remove this supplement when the migration contracts are published.
// HOST-T2: institution.assignment.get from API 1.38.0; the work-language GET is provisional.
// WEB-1604: work.source-notes.get from Institution_server 093f9b7 (API 1.52.0).
// WEB-1302B: student data export routes from Institution_server d92115c (API 1.75.0).
// Faza 3 (WEB-2001, WEB-2002): consultation slots and student mentorship routes from Institution_server 9e67d7ca (API 1.75.0).
// Faza 3 (WEB-2004, WEB-2005): bulk download link, submission package link and PDF export routes from Institution_server 9e67d7ca (API 1.75.0).
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
  "student.text-check-config.get": {
    params: { "assignmentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "enabledCheckIds": (string)[]; "lektaProfileId": string | null }; headers: {  } };
    errorCode: "invalid_assignment_id" | "unauthorized" | "not_found" | "unavailable";
  };
  "student.assignment-requirements.get": {
    params: { "assignmentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "wordRange": { "min": number; "max": number | null } | { "min": null; "max": number } | null }; headers: {  } };
    errorCode: "unauthorized" | "not_found" | "unavailable";
  };
  // SRV-1408 (Institution_server #548), followed by the provisional WEB-1405 view.
  "institution.teaching-group-members.put": {
    params: { "id": string; "groupId": string };
    query: undefined;
    body: { "assistantIds": (string)[]; "studentIds": (string)[] };
    success: { status: 200; body: { "updated": true }; headers: {  } };
    errorCode: "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "invalid_json" | "unauthorized" | "forbidden" | "origin_missing" | "origin_mismatch" | "cross_site" | "body_timeout" | "conflict" | "body_too_large" | "unsupported_media_type" | "invalid_input" | "unavailable";
  };
  "institution.teaching-team.get": {
    params: { "id": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "holderId": string | null; "assistantIds": (string)[] }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "invalid_input" | "unavailable";
  };
  "institution.teaching-team.post": {
    params: { "id": string };
    query: undefined;
    body: { "assistantIds": (string)[] };
    success: { status: 200; body: { "updated": true }; headers: {  } };
    errorCode: "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "invalid_json" | "unauthorized" | "forbidden" | "origin_missing" | "origin_mismatch" | "cross_site" | "body_timeout" | "body_too_large" | "unsupported_media_type" | "invalid_input" | "unavailable";
  };
  "institution.teaching-team-view.get": {
    params: { "id": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "role": "holder"; "holderId": string; "assistants": ({ "id": string; "name": string })[]; "students": ({ "id": string; "name": string; "groupId": string | null })[]; "groups": ({ "id": string; "name": string; "assistantIds": (string)[] })[] } | { "role": "assistant"; "groups": ({ "id": string; "name": string; "students": ({ "id": string; "name": string })[] })[] }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "invalid_input" | "unavailable";
  };
  "work.source-notes.get": {
    params: { "id": string; "sourceId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "notes": ({ "id": string; "quote": string | null; "page": string | null; "note": string | null })[] }; headers: {  } };
    errorCode: "unauthorized" | "not_found" | "unavailable";
  };
  // SRV-1906, Institution_server f31edd7 (API 1.60.0).
  "ops.pilot-metrics.get": {
    params: undefined;
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "asOf": string; "minimumGroup": 5; "submissions": { "recorded": 0 | number | null; "notRecorded": 0 | number | null }; "receipts": { "issued": 0 | number | null; "pending": 0 | number | null }; "helpRequests": { "total": 0 | number | null; "saveProblems": 0 | number | null }; "receiptTime": { "p50Ms": number | null; "p95Ms": number | null } }; headers: {  } };
    errorCode: "unauthenticated" | "forbidden" | "invalid_input" | "unavailable";
  };
  // WEB-1406: provisional contract of the faculty rules (no server route yet); replaced by the published one (WEB-07).
  "institution.faculty-rules.get": {
    params: undefined;
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "rules": ({ "workType": "short_paper" | "essay" | "seminar_paper" | "bachelor_thesis" | "master_thesis" | "specialist_thesis" | "doctoral_thesis"; "versions": ({ "versionNo": number; "aiPolicy": "prohibited" | "partially_allowed" | "encouraged"; "aiPurposes": ("formatting" | "proofreading" | "literature_search" | "transcription" | "translation")[]; "evidenceProfile": "basic" | "extended"; "importAllowed": boolean; "origin": "operator" | "administrator"; "publishedAt": string })[] })[] }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "unavailable";
  };
  "institution.faculty-rules.post": {
    params: undefined;
    query: undefined;
    body: { "workType": "short_paper" | "essay" | "seminar_paper" | "bachelor_thesis" | "master_thesis" | "specialist_thesis" | "doctoral_thesis"; "basedOnVersionNo": number | null; "aiPolicy": "prohibited" | "partially_allowed" | "encouraged"; "aiPurposes": ("formatting" | "proofreading" | "literature_search" | "transcription" | "translation")[]; "evidenceProfile": "basic" | "extended"; "importAllowed": boolean };
    success: { status: 201; body: { "versionNo": number; "publishedAt": string }; headers: {  } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "forbidden" | "invalid_json" | "unsupported_media_type" | "unavailable" | "conflict" | "invalid_input" | "invalid_work_type" | "invalid_ai_policy" | "invalid_ai_purposes" | "invalid_evidence_profile";
  };
  // SRV-1904, Institution_server 1a4ac0d (API 1.65.0).
  "teacher.assignment-copy.post": {
    params: { "assignmentId": string };
    query: undefined;
    body: { "requestKey": string; "courseId": string; "opensAt"?: string; "dueAt"?: string };
    success: { status: 201; body: { "id": string; "versionNo": 1 }; headers: { "cache-control"?: string } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "unsupported_media_type" | "invalid_json" | "invalid_input" | "not_found" | "conflict" | "unavailable";
  };
  // WEB-1301: provisional contract of data retention and legal holds (no server route yet); replaced by the published one (WEB-07).
  "institution.retention.get": {
    params: undefined;
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "classes": ({ "classId": string; "name": string; "retentionDays": number | null; "mode": "dry_run" | "delete" })[] }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "unavailable";
  };
  "institution.legal-holds.get": {
    params: undefined;
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "holds": ({ "id": string; "subject": string; "caseReference": string; "placedAt": string; "placedByName": string; "own": boolean })[] }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "unavailable";
  };
  "institution.legal-holds.post": {
    params: undefined;
    query: undefined;
    body: { "subject": string; "caseReference": string };
    success: { status: 201; body: { "id": string }; headers: {  } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "forbidden" | "invalid_json" | "unsupported_media_type" | "unavailable" | "conflict" | "invalid_input";
  };
  "institution.legal-hold-release.post": {
    params: { "holdId": string };
    query: undefined;
    body: { "reason": string };
    success: { status: 200; body: { "id": string; "releasedAt": string }; headers: {  } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "forbidden" | "invalid_json" | "unsupported_media_type" | "unavailable" | "conflict" | "invalid_input" | "not_found";
  };
  "institution.student-data-exports.get": {
    params: undefined;
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "exports": ({ "exportId": string; "state": "requested" | "approved" | "ready" | "downloaded" | "expired"; "requestedAt": string; "expiresAt": string | null })[] }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "unavailable";
  };
  "institution.student-data-exports.post": {
    params: undefined;
    query: undefined;
    body: { "studentId": string; "identityCheckedBy": "identity_card" | "passport" | "student_card"; "note": string };
    success: { status: 201; body: { "exportId": string }; headers: {  } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "invalid_input" | "unsupported_media_type" | "invalid_json" | "forbidden" | "not_found" | "conflict" | "unavailable";
  };
  "institution.student-data-exports-approve.post": {
    params: { "exportId": string };
    query: undefined;
    body: { "reference": string };
    success: { status: 200; body: { "exportId": string; "state": "approved" }; headers: {  } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "invalid_input" | "unsupported_media_type" | "invalid_json" | "forbidden" | "not_found" | "conflict" | "unavailable";
  };
  "student.data-export.get": {
    params: { "token": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: undefined; headers: {  } };
    errorCode: "not_allowed" | "unavailable";
  };
  "work.consultation-slots.get": {
    params: { "documentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "slots": ({ "id": string; "startsAt": string; "proposedAt": string; "state": "requested" | "countered" | "confirmed" })[] }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "not_found" | "unavailable";
  };
  "work.consultation-slots.post": {
    params: { "documentId": string };
    query: undefined;
    body: { "startsAt": string };
    success: { status: 201; body: { "id": string; "startsAt": string; "proposedAt": string; "state": "requested" | "countered" | "confirmed" }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "not_found" | "unavailable" | "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "invalid_json" | "unsupported_media_type" | "invalid_input";
  };
  "work.consultation-slots.patch": {
    params: { "documentId": string; "slotId": string };
    query: undefined;
    body: { "action": "confirm" } | { "action": "counter"; "startsAt": string } | { "action": "accept" };
    success: { status: 200; body: { "id": string; "startsAt": string; "proposedAt": string; "state": "requested" | "countered" | "confirmed" }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "not_found" | "unavailable" | "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "invalid_json" | "unsupported_media_type" | "invalid_input" | "conflict";
  };
  "mentorship.student-mentor-candidates.get": {
    params: undefined;
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "candidates": ({ "teacherId": string; "name": { "givenName": string; "familyName": string } | null; "department": string | null })[] }; headers: { "cache-control"?: string } };
    errorCode: "unauthorized" | "forbidden" | "unavailable";
  };
  "mentorship.student-requests.get": {
    params: undefined;
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "requests": ({ "requestId": string; "teacherId": string; "teacherName": { "givenName": string; "familyName": string } | null; "workType": "bachelor_thesis" | "master_thesis" | "specialist_thesis" | "doctoral_thesis"; "requestedAt": string; "state": "requested"; "endedAt": null; "mentorshipId": null } | { "requestId": string; "teacherId": string; "teacherName": { "givenName": string; "familyName": string } | null; "workType": "bachelor_thesis" | "master_thesis" | "specialist_thesis" | "doctoral_thesis"; "requestedAt": string; "state": "approved"; "endedAt": string; "mentorshipId": string } | { "requestId": string; "teacherId": string; "teacherName": { "givenName": string; "familyName": string } | null; "workType": "bachelor_thesis" | "master_thesis" | "specialist_thesis" | "doctoral_thesis"; "requestedAt": string; "state": "declined"; "endedAt": string; "mentorshipId": null } | { "requestId": string; "teacherId": string; "teacherName": { "givenName": string; "familyName": string } | null; "workType": "bachelor_thesis" | "master_thesis" | "specialist_thesis" | "doctoral_thesis"; "requestedAt": string; "state": "withdrawn"; "endedAt": string; "mentorshipId": null })[] }; headers: { "cache-control"?: string } };
    errorCode: "unauthorized" | "forbidden" | "unavailable";
  };
  "mentorship.requests.post": {
    params: undefined;
    query: undefined;
    body: { "teacherId": string; "workType": "bachelor_thesis" | "master_thesis" | "specialist_thesis" | "doctoral_thesis" };
    success: { status: 201; body: { "requestId": string; "state": "requested" }; headers: { "cache-control"?: string } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "not_found" | "conflict" | "unavailable" | "unsupported_media_type" | "invalid_json" | "invalid_input";
  };
  "mentorship.request-withdraw.post": {
    params: { "requestId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "requestId": string; "state": "withdrawn" }; headers: { "cache-control"?: string } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "not_found" | "conflict" | "unavailable";
  };
  "teacher.submissions-bulk-link.post": {
    params: { "assignmentId": string };
    query: undefined;
    body: { "format": "pdf" | "docx" };
    success: { status: 201; body: { "format": "pdf" | "docx"; "downloadPath": string; "expiresAt": string }; headers: { "cache-control"?: string } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "unsupported_media_type" | "invalid_json" | "invalid_input" | "not_found" | "unavailable";
  };
  "student.submission-package-link.post": {
    params: { "submissionId": string };
    query: undefined;
    body: { "kind": "package" | "referada" };
    success: { status: 201; body: { "kind": "package" | "referada"; "downloadPath": string; "expiresAt": string }; headers: { "cache-control"?: string } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "unsupported_media_type" | "invalid_json" | "invalid_input" | "not_found" | "unavailable";
  };
  "work.export-pdf.get": {
    params: { "assignmentId": string; "documentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "filename": "rad.pdf"; "pdfBase64": string; "outputSha256": string; "format": "pdf"; "reportHash": null; "docxBase64": string; "noticeKey": "workExport.plainPdf" } | { "filename": "rad.pdf"; "pdfBase64": string; "outputSha256": string; "format": "pdfa-2u"; "reportHash": string }; headers: { "cache-control"?: string } };
    errorCode: "unauthorized" | "forbidden" | "not_found" | "unavailable";
  };
};
