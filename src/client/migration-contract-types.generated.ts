// Generated subset of Institution_server a62e0db (API 1.24.0).
// WEB-07: remove this supplement when the migration contracts are published.
// HOST-T2: institution.assignment.get from API 1.38.0; the work-language GET is provisional.
// WEB-1604: work.source-notes.get from Institution_server 093f9b7 (API 1.52.0).
// WEB-1302B: student data export routes from Institution_server d92115c (API 1.75.0).
// Faza 3 (WEB-2001, WEB-2002): consultation slots and student mentorship routes from Institution_server 9e67d7ca (API 1.75.0).
// Faza 3 (WEB-2004, WEB-2005): bulk download, submission package and PDF export routes from Institution_server 9e67d7ca (API 1.75.0).
// Faza 3 (WEB-2003): submission withdrawal routes from Institution_server e299665f (API 1.76.0).
// Faza 3 (WEB-2007): work comparison route from Institution_server 7aab1437 (API 1.76.0).
// Faza 3 (WEB-2008): teaching team view from Institution_server 34b0a9a1 (#607, SRV-2007, API 1.78.0).
// LOK-WEB-5: teacher mentorship request routes from Institution_server d8b7fc40 (API 1.79.0).
// Faza 3: work.milestone-states.get, work.milestones.approve.post, work.milestones.delete, work.milestones.details.patch, work.milestones.request-revision.post, work.milestones.submit.post, work.interview.get, work.interview-appointment.put, work.interview-explanations.post, work.interview-held.post, work.interview-invite.post, work.interview-pdf.get, work.interview-questions.delete, work.interview-questions.post, work.source-notes.post, work.source-notes.patch, work.source-notes.delete, teacher.courses.get, teacher.course-students.get, course.aggregate.get, teacher.declaration.get, teacher.submissions.get, teacher.submission-detail.get, work.origin-composition.get, work.origin-thresholds.get, work.changes-since-review.get, student.declaration.get, student.submission.get from Institution_server 844fc8aa (API 1.83.0).
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
    success: { status: 200; body: { "institution": { "slug": string; "displayName": string | null }; "roles": ("student" | "teacher" | "network_engineer" | "institution_admin")[]; "displayName": string | null; "journalScope": string; "sessionTag": string }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "unavailable";
  };
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
  "teacher.assignment-overview.get": {
    params: { "assignmentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "students": ({ "studentId": string; "givenName": string | null; "familyName": string | null; "groupName": string | null; "submitted": boolean; "requestedMinute": string | null; "afterDeadline": boolean | null; "evidenceRecord": "continuous" | "with_gaps" | null })[] }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "unavailable";
  };
  "teacher.deadline-extension.post": {
    params: { "assignmentId": string };
    query: undefined;
    body: { "scope": "one"; "studentId": string; "dueAt": string; "reasonId": "justified" | "technical" | "agreement" } | { "scope": "all"; "dueAt": string; "reasonId": "justified" | "technical" | "agreement" | "all" };
    success: { status: 201; body: { "extension": { "id": string; "scope": "one" | "all"; "studentId": string | null; "previousDueAt": string; "dueAt": string; "reasonId": "justified" | "technical" | "agreement" | "all" | null; "createdBy": string; "createdAt": string }; "existingSubmissionsUnchanged": boolean }; headers: {  } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "unsupported_media_type" | "invalid_json" | "invalid_input" | "not_found" | "unavailable";
  };
  "teacher.deadline-extensions.get": {
    params: { "assignmentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "extensions": ({ "id": string; "scope": "one" | "all"; "studentId": string | null; "previousDueAt": string; "dueAt": string; "reasonId": "justified" | "technical" | "agreement" | "all" | null; "createdBy": string; "createdAt": string })[] }; headers: {  } };
    errorCode: "unauthorized" | "not_found" | "unavailable";
  };
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
  "student.notice.get": {
    params: { "assignmentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "assignmentId": string; "versionNo": number; "templateVersion": number; "title": string; "instructions": string; "workType": "short_paper" | "essay" | "seminar_paper" | "bachelor_thesis" | "master_thesis" | "specialist_thesis" | "doctoral_thesis"; "opensAt": string; "dueAt": string; "aiPolicy": "prohibited" | "partially_allowed" | "encouraged"; "aiPurposes": ("formatting" | "proofreading" | "literature_search" | "transcription" | "translation")[]; "evidenceProfile": "basic" | "extended"; "wordMin": number | null; "wordMax": number | null; "readAt": string | null; "acknowledgedAt": string | null }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "not_found" | "unavailable";
  };
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
  "teacher.submission-receipt.get": {
    params: { "assignmentId": string; "studentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "state": "none" } | { "state": "ceka"; "revision": number; "requestedAt": string } | { "state": "potvrdeno"; "receipt": { "payload": { "receiptSchema": "ductus-submission-receipt-v2"; "submissionId": string; "evidenceDomainId": string; "principalId": string; "assignmentId": string; "assignmentVersion": number; "documentId": string; "evidencePackageId": string; "revision": number; "artifactSha256": string; "evidenceHeadSegmentHash": string; "evidenceRecord": "continuous" | "with_gaps"; "requestedAt": string; "dueAt": string; "afterDeadline": boolean; "signedAt": string }; "payloadDigestSha256": string; "signature": { "algorithm": "Ed25519"; "keyId": string; "keyVersion": string; "signatureEncoding": "raw"; "signatureBase64Url": string } } }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "not_found" | "unavailable";
  };
  "teacher.work.get": {
    params: { "documentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "documentId": string; "studentId": string; "studentName": string | null; "assignmentId": string; "state": "predano" | "nije_predano" | "nakon_roka" | "ceka"; "prevDocumentId": string | null; "nextDocumentId": string | null }; headers: {  } };
    errorCode: "unauthorized" | "not_found" | "unavailable";
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
  "ops.pilot-metrics.get": {
    params: undefined;
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "asOf": string; "minimumGroup": 5; "submissions": { "recorded": 0 | number | null; "notRecorded": 0 | number | null }; "receipts": { "issued": 0 | number | null; "pending": 0 | number | null }; "helpRequests": { "total": 0 | number | null; "saveProblems": 0 | number | null }; "receiptTime": { "p50Ms": number | null; "p95Ms": number | null } }; headers: {  } };
    errorCode: "unauthenticated" | "forbidden" | "invalid_input" | "unavailable";
  };
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
  "teacher.assignment-copy.post": {
    params: { "assignmentId": string };
    query: undefined;
    body: { "requestKey": string; "courseId": string; "opensAt"?: string; "dueAt"?: string };
    success: { status: 201; body: { "id": string; "versionNo": 1 }; headers: { "cache-control"?: string } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "unsupported_media_type" | "invalid_json" | "invalid_input" | "not_found" | "conflict" | "unavailable";
  };
  "institution.retention.get": {
    params: undefined;
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "classes": ({ "key": "sessions" | "live-state" | "versions" | "change-times" | "access-log" | "receipts"; "label": string; "retentionDays": number | null; "mode": "execute" | "dry-run"; "candidates": number | null; "lastRunAt": string | null })[] }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "unavailable";
  };
  "institution.legal-holds.get": {
    params: undefined;
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "holds": ({ "holdId": string; "subjectType": "work" | "student" | "assignment"; "subjectId": string; "caseReference": string; "placedBy": string; "placedAt": string; "releasedBy": string | null; "releasedAt": string | null })[] }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "unavailable";
  };
  "institution.legal-holds.post": {
    params: undefined;
    query: undefined;
    body: { "subjectType": "work" | "student" | "assignment"; "subjectId": string; "caseReference": string };
    success: { status: 201; body: { "holdId": string }; headers: {  } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "forbidden" | "invalid_json" | "unsupported_media_type" | "unavailable" | "invalid_input" | "not_found";
  };
  "institution.legal-hold-release.post": {
    params: { "holdId": string };
    query: undefined;
    body: { "reason": string };
    success: { status: 200; body: { "holdId": string; "releasedAt": string }; headers: {  } };
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
  "teacher.submissions-bulk.get": {
    params: { "assignmentId": string; "format": "pdf" | "docx" };
    query: { "token": string };
    body: undefined;
    success: { status: 200; body: undefined; headers: { "content-disposition"?: string; "cache-control"?: string; "x-content-sha256"?: string } };
    errorCode: "unauthorized" | "forbidden" | "not_found" | "not_allowed" | "unavailable";
  };
  "student.submission-package-link.post": {
    params: { "submissionId": string };
    query: undefined;
    body: { "kind": "package" | "referada" };
    success: { status: 201; body: { "kind": "package" | "referada"; "downloadPath": string; "expiresAt": string }; headers: { "cache-control"?: string } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "unsupported_media_type" | "invalid_json" | "invalid_input" | "not_found" | "unavailable";
  };
  "student.submission-package.get": {
    params: { "submissionId": string; "kind": "package" | "referada" };
    query: { "token": string };
    body: undefined;
    success: { status: 200; body: undefined; headers: { "content-disposition"?: string; "cache-control"?: string; "x-content-sha256"?: string } };
    errorCode: "unauthorized" | "forbidden" | "not_found" | "not_allowed" | "unavailable";
  };
  "work.export-pdf.get": {
    params: { "assignmentId": string; "documentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "filename": "rad.pdf"; "pdfBase64": string; "outputSha256": string; "format": "pdf"; "reportHash": null; "docxBase64": string; "noticeKey": "workExport.plainPdf" } | { "filename": "rad.pdf"; "pdfBase64": string; "outputSha256": string; "format": "pdfa-2u"; "reportHash": string }; headers: { "cache-control"?: string } };
    errorCode: "unauthorized" | "forbidden" | "not_found" | "unavailable";
  };
  "student.submission-withdrawal.get": {
    params: { "assignmentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "withdrawable": boolean; "receipts": ({ "withdrawalId": string; "assignmentId": string; "revision": number; "withdrawnAt": string; "signature": string })[] }; headers: { "cache-control"?: string } };
    errorCode: "unauthorized" | "not_found" | "unavailable";
  };
  "student.submission-withdrawal.post": {
    params: { "assignmentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "status": "withdrawn"; "receipt": { "payload": { "receiptSchema": "ductus-submission-withdrawal-receipt-v1"; "withdrawalId": string; "submissionId": string; "submissionReceiptSha256": string; "evidenceDomainId": string; "principalId": string; "assignmentId": string; "withdrawnAt": string; "dueAt": string; "signedAt": string }; "payloadDigestSha256": string; "signature": { "algorithm": "Ed25519"; "keyId": string; "keyVersion": string; "signatureEncoding": "raw"; "signatureBase64Url": string } } }; headers: { "cache-control"?: string } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "not_found" | "not_allowed" | "refused" | "not_started" | "conflict" | "unavailable";
  };
  "teacher.submission-withdrawal.get": {
    params: { "assignmentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "allowed": boolean; "changedAt": string | null }; headers: { "cache-control"?: string } };
    errorCode: "unauthorized" | "not_found" | "unavailable";
  };
  "teacher.submission-withdrawal.post": {
    params: { "assignmentId": string };
    query: undefined;
    body: { "allowed": boolean };
    success: { status: 200; body: { "allowed": boolean; "changedAt": string | null }; headers: { "cache-control"?: string } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "unsupported_media_type" | "invalid_json" | "invalid_input" | "not_found" | "unavailable";
  };
  "work.compare.get": {
    params: { "documentId": string };
    query: { from: string; to: string };
    body: undefined;
    success: { status: 200; body: { from: number; to: number; "blocks": ({ "kind": "paragraph" | "bulletItem" | "quote"; "change": "unchanged" | "removed" | "added"; "text": string } | { "kind": "heading"; "level": number; "change": "unchanged" | "removed" | "added"; "text": string })[] }; headers: {  } };
    errorCode: "unauthorized" | "not_found" | "invalid_input" | "unavailable";
  };
  "teacher.mentorship-requests.get": {
    params: undefined;
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "requests": ({ "requestId": string; "student": { "givenName": string; "familyName": string } | null; "workType": "bachelor_thesis" | "master_thesis" | "specialist_thesis" | "doctoral_thesis"; "requestedAt": string })[] }; headers: { "cache-control"?: string } };
    errorCode: "unauthorized" | "forbidden" | "unavailable";
  };
  "teacher.mentorship-request-decision.post": {
    params: undefined;
    query: undefined;
    body: { "requestId": string; "decision": "approve" } | { "requestId": string; "decision": "decline"; "reason"?: string };
    success: { status: 200; body: { "decision": "approve"; "mentorshipId": string } | { "decision": "decline" }; headers: { "cache-control"?: string } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "forbidden" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "conflict" | "unavailable" | "unsupported_media_type" | "invalid_json" | "invalid_input";
  };
  "teacher.working-criteria.get": {
    params: { "documentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "criteria": ({ "id": "topic" | "structure" | "sources" | "method" | "language" | "formatting"; "label": string; "assessment": 0 | 1 | 2 | null; "note": string | null })[] }; headers: {  } };
    errorCode: "unauthorized" | "not_found" | "unavailable";
  };
  "teacher.working-criterion.put": {
    params: { "documentId": string; "criterionId": string };
    query: undefined;
    body: { "assessment": 0 | 1 | 2 | null; "note": string | null };
    success: { status: 200; body: { "id": "topic" | "structure" | "sources" | "method" | "language" | "formatting"; "label": string; "assessment": 0 | 1 | 2 | null; "note": string | null }; headers: {  } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "not_found" | "unsupported_media_type" | "invalid_json" | "invalid_input" | "unavailable";
  };
  "teacher.submission-history.get": {
    params: { "assignmentId": string; "studentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "events": ({ "kind": "submission"; "id": string; "attempt": number; "submissionId": string; "revision": number; "at": string; "afterDeadline": boolean; "receipt": { "payload": { "receiptSchema": "ductus-submission-receipt-v2"; "submissionId": string; "evidenceDomainId": string; "principalId": string; "assignmentId": string; "assignmentVersion": number; "documentId": string; "evidencePackageId": string; "revision": number; "artifactSha256": string; "evidenceHeadSegmentHash": string; "evidenceRecord": "continuous" | "with_gaps"; "requestedAt": string; "dueAt": string; "afterDeadline": boolean; "signedAt": string }; "payloadDigestSha256": string; "signature": { "algorithm": "Ed25519"; "keyId": string; "keyVersion": string; "signatureEncoding": "raw"; "signatureBase64Url": string } } | null } | { "kind": "withdrawal"; "id": string; "attempt": number; "submissionId": string; "revision": number; "at": string; "receipt": { "payload": { "receiptSchema": "ductus-submission-withdrawal-receipt-v1"; "withdrawalId": string; "submissionId": string; "submissionReceiptSha256": string; "evidenceDomainId": string; "principalId": string; "assignmentId": string; "withdrawnAt": string; "dueAt": string; "signedAt": string }; "payloadDigestSha256": string; "signature": { "algorithm": "Ed25519"; "keyId": string; "keyVersion": string; "signatureEncoding": "raw"; "signatureBase64Url": string } } | null })[] }; headers: { "cache-control"?: string } };
    errorCode: "unauthorized" | "not_found" | "unavailable";
  };
  "work.milestone-states.get": {
    params: { "documentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "milestones": ({ "id": string; "title": string; "description": string; "dueAt": string | null; "state": "not_submitted" | "submitted" | "revision_requested" | "approved"; "everSubmitted": boolean; "submittedRevisionId": number | null; "submittedAt": string | null; "revisionComment": string | null; "revisionDueAt": string | null; "revisionRequestedAt": string | null; "approvedAt": string | null; "approvalMessage": string | null })[] }; headers: {  } };
    errorCode: "unauthorized" | "not_found" | "unavailable";
  };
  "work.milestones.approve.post": {
    params: { "documentId": string; "milestoneId": string };
    query: undefined;
    body: { "message"?: string };
    success: { status: 200; body: { "id": string; "title": string; "description": string; "dueAt": string | null; "state": "not_submitted" | "submitted" | "revision_requested" | "approved"; "everSubmitted": boolean; "submittedRevisionId": number | null; "submittedAt": string | null; "revisionComment": string | null; "revisionDueAt": string | null; "revisionRequestedAt": string | null; "approvedAt": string | null; "approvalMessage": string | null }; headers: {  } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "not_found" | "unavailable" | "invalid_json" | "forbidden" | "conflict" | "unsupported_media_type" | "invalid_input";
  };
  "work.milestones.delete": {
    params: { "documentId": string; "milestoneId": string };
    query: undefined;
    body: undefined;
    success: { status: 204; body: undefined; headers: {  } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "not_found" | "unavailable" | "forbidden" | "conflict";
  };
  "work.milestones.details.patch": {
    params: { "documentId": string; "milestoneId": string };
    query: undefined;
    body: { "dueAt"?: string; "title"?: string };
    success: { status: 200; body: { "id": string; "title": string; "description": string; "dueAt": string | null; "state": "not_submitted" | "submitted" | "revision_requested" | "approved"; "everSubmitted": boolean; "submittedRevisionId": number | null; "submittedAt": string | null; "revisionComment": string | null; "revisionDueAt": string | null; "revisionRequestedAt": string | null; "approvedAt": string | null; "approvalMessage": string | null }; headers: {  } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "not_found" | "unavailable" | "invalid_json" | "forbidden" | "conflict" | "unsupported_media_type" | "invalid_input";
  };
  "work.milestones.request-revision.post": {
    params: { "documentId": string; "milestoneId": string };
    query: undefined;
    body: { "comment": string; "revisionDueAt"?: string };
    success: { status: 200; body: { "id": string; "title": string; "description": string; "dueAt": string | null; "state": "not_submitted" | "submitted" | "revision_requested" | "approved"; "everSubmitted": boolean; "submittedRevisionId": number | null; "submittedAt": string | null; "revisionComment": string | null; "revisionDueAt": string | null; "revisionRequestedAt": string | null; "approvedAt": string | null; "approvalMessage": string | null }; headers: {  } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "not_found" | "unavailable" | "invalid_json" | "forbidden" | "conflict" | "unsupported_media_type" | "invalid_input";
  };
  "work.milestones.submit.post": {
    params: { "documentId": string; "milestoneId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "id": string; "title": string; "description": string; "dueAt": string | null; "state": "not_submitted" | "submitted" | "revision_requested" | "approved"; "everSubmitted": boolean; "submittedRevisionId": number | null; "submittedAt": string | null; "revisionComment": string | null; "revisionDueAt": string | null; "revisionRequestedAt": string | null; "approvedAt": string | null; "approvalMessage": string | null }; headers: {  } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "not_found" | "unavailable" | "forbidden" | "conflict";
  };
  "work.interview.get": {
    params: { "documentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "invitedAt": string | null; "questions": ({ "id": string; "paragraphRef": string | null; "questionText": string; "createdAt": string; "mine": boolean })[]; "explanations": ({ "id": string; "questionId": string | null; "text": string; "createdAt": string })[]; "appointment": { "consultationSlotId": string; "startsAt": string } | { "place": string; "at": string } | null; "heldOn": string | null }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "not_found" | "unavailable";
  };
  "work.interview-appointment.put": {
    params: { "documentId": string };
    query: undefined;
    body: { "consultationSlotId": string } | { "place": string; "at": string };
    success: { status: 200; body: { "invitedAt": string | null; "questions": ({ "id": string; "paragraphRef": string | null; "questionText": string; "createdAt": string; "mine": boolean })[]; "explanations": ({ "id": string; "questionId": string | null; "text": string; "createdAt": string })[]; "appointment": { "consultationSlotId": string; "startsAt": string } | { "place": string; "at": string } | null; "heldOn": string | null }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "not_found" | "unavailable" | "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "invalid_json" | "unsupported_media_type" | "invalid_input" | "conflict";
  };
  "work.interview-explanations.post": {
    params: { "documentId": string };
    query: undefined;
    body: { "questionId"?: string | null; "text": string };
    success: { status: 201; body: { "id": string; "questionId": string | null; "text": string; "createdAt": string }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "not_found" | "unavailable" | "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "invalid_json" | "unsupported_media_type" | "invalid_input";
  };
  "work.interview-held.post": {
    params: { "documentId": string };
    query: undefined;
    body: { "date": string };
    success: { status: 200; body: { "invitedAt": string | null; "questions": ({ "id": string; "paragraphRef": string | null; "questionText": string; "createdAt": string; "mine": boolean })[]; "explanations": ({ "id": string; "questionId": string | null; "text": string; "createdAt": string })[]; "appointment": { "consultationSlotId": string; "startsAt": string } | { "place": string; "at": string } | null; "heldOn": string | null }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "not_found" | "unavailable" | "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "invalid_json" | "unsupported_media_type" | "invalid_input" | "conflict";
  };
  "work.interview-invite.post": {
    params: { "documentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "invitedAt": string | null; "questions": ({ "id": string; "paragraphRef": string | null; "questionText": string; "createdAt": string; "mine": boolean })[]; "explanations": ({ "id": string; "questionId": string | null; "text": string; "createdAt": string })[]; "appointment": { "consultationSlotId": string; "startsAt": string } | { "place": string; "at": string } | null; "heldOn": string | null }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "not_found" | "unavailable" | "origin_missing" | "origin_mismatch" | "cross_site" | "conflict";
  };
  "work.interview-pdf.get": {
    params: { "documentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "filename": "priprema-za-razgovor.pdf"; "pdfBase64": string }; headers: { "cache-control"?: string } };
    errorCode: "unauthorized" | "forbidden" | "not_found" | "conflict" | "unavailable";
  };
  "work.interview-questions.delete": {
    params: { "documentId": string; "questionId": string };
    query: undefined;
    body: undefined;
    success: { status: 204; body: undefined; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "not_found" | "unavailable" | "origin_missing" | "origin_mismatch" | "cross_site";
  };
  "work.interview-questions.post": {
    params: { "documentId": string };
    query: undefined;
    body: { "paragraphRef"?: string | null; "questionText": string };
    success: { status: 201; body: { "id": string; "paragraphRef": string | null; "questionText": string; "createdAt": string; "mine": boolean }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "not_found" | "unavailable" | "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "invalid_json" | "unsupported_media_type" | "invalid_input";
  };
  "work.source-notes.post": {
    params: { "id": string; "sourceId": string };
    query: undefined;
    body: { "quote"?: string | null; "page"?: string | null; "note"?: string | null };
    success: { status: 201; body: { "id": string; "quote": string | null; "page": string | null; "note": string | null }; headers: {  } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "not_found" | "unavailable" | "unsupported_media_type" | "invalid_json" | "invalid_input";
  };
  "work.source-notes.patch": {
    params: { "id": string; "sourceId": string };
    query: undefined;
    body: { "noteId": string; "quote"?: string | null; "page"?: string | null; "note"?: string | null };
    success: { status: 200; body: { "id": string; "quote": string | null; "page": string | null; "note": string | null }; headers: {  } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "not_found" | "unavailable" | "unsupported_media_type" | "invalid_json" | "invalid_input";
  };
  "work.source-notes.delete": {
    params: { "id": string; "sourceId": string };
    query: { "noteId": string };
    body: undefined;
    success: { status: 204; body: undefined; headers: {  } };
    errorCode: "origin_missing" | "origin_mismatch" | "cross_site" | "body_too_large" | "body_timeout" | "content_length_invalid" | "content_length_mismatch" | "body_stream_error" | "unauthorized" | "not_found" | "unavailable" | "invalid_input";
  };
  "teacher.courses.get": {
    params: undefined;
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "courses": ({ "id": string; "name": string; "academicYear": string; "aiPolicy": "prohibited" | "partially_allowed" | "encouraged"; "assignments": ({ "id": string; "title": string; "workType": "short_paper" | "essay" | "seminar_paper" | "bachelor_thesis" | "master_thesis" | "specialist_thesis" | "doctoral_thesis"; "opensAt": string; "dueAt": string; "currentVersion": number; "enrolledStudents": number })[] })[] }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "not_found" | "unavailable";
  };
  "teacher.course-students.get": {
    params: { "courseId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "students": ({ "studentId": string; "givenName": string; "familyName": string; "groupName": string | null; "assignments": ({ "assignmentId": string; "documentId": string | null; "workState": "not_started" | "in_progress" | "submitted" })[] } | { "studentId": string; "givenName": null; "familyName": null; "groupName": string | null; "assignments": ({ "assignmentId": string; "documentId": string | null; "workState": "not_started" | "in_progress" | "submitted" })[] })[] }; headers: { "cache-control"?: string } };
    errorCode: "unauthorized" | "forbidden" | "unavailable";
  };
  "course.aggregate.get": {
    params: { "id": string };
    query: { [key: string]: unknown };
    body: undefined;
    success: { status: 200; body: { "status": "suppressed" } | { "status": "available"; "started": number; "submitted": number; "stages": { "notStarted": number; "inProgress": number; "submitted": number } }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "not_found" | "invalid_input" | "unavailable";
  };
  "teacher.declaration.get": {
    params: { "assignmentId": string; "studentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "state": "none"; "payload": null; "declarationSha256": null } | { "state": "bound"; "payload": { "declarationSchema": "ductura-declaration-v1"; "declarationId": string; "declarationVersion": number; "principalId": string; "assignmentId": string; "assignmentVersion": number; "documentId": string; "revision": number; "form": { "formId": string; "formVersion": number; "formSha256": string }; "ownWork": { "confirmed": true }; "humanHelp": { "received": boolean; "entries": ({ "kind": "language" | "structure" | "sources" | "content" | "technical" | "other"; "text": string })[] }; "ai": { "use": "used" | "not_used"; "declaredTools": ({ "toolLabel": string; "purposeText": string; "phaseText": string })[]; "recorded": ({ "aiTransferId": string; "aiTransferSha256": string })[]; "attachments": ({ "externalAttachmentId": string; "format": "application/pdf" | "text/plain"; "byteLength": number; "contentSha256": string; "reason": "external_upload" })[] }; "confirmedAt": string }; "declarationSha256": string }; headers: { "cache-control"?: string } };
    errorCode: "unauthorized" | "forbidden" | "not_found" | "unavailable";
  };
  "teacher.submissions.get": {
    params: { "assignmentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "submissions": ({ "studentId": string; "documentId": string | null; "submitted": false; "revision": null; "requestedMinute": null; "afterDeadline": null } | { "studentId": string; "documentId": string | null; "submitted": true; "revision": number; "requestedMinute": string; "afterDeadline": boolean })[] }; headers: {  } };
    errorCode: "unauthorized" | "forbidden" | "unavailable";
  };
  "teacher.submission-detail.get": {
    params: { "assignmentId": string; "studentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "studentId": string; "revision": number; "late": boolean; "document": string }; headers: { "cache-control"?: string } };
    errorCode: "unauthorized" | "forbidden" | "not_found" | "unavailable";
  };
  "work.origin-composition.get": {
    params: { "documentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "parts": ({ "kind": "typed" | "assistant_inserted" | "assistant_match" | "imported_file" | "pasted_known" | "pasted_unknown"; "percent": number })[] }; headers: {  } };
    errorCode: "unauthorized" | "not_found" | "unavailable";
  };
  "work.origin-thresholds.get": {
    params: { "documentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "comparison": ({ "origin": "typed" | "assistant_inserted" | "assistant_match" | "imported_file" | "pasted_known" | "pasted_unknown"; "state": "in_line" | "for_review" | "exceeded" })[] }; headers: {  } };
    errorCode: "unauthorized" | "not_found" | "unavailable";
  };
  "work.changes-since-review.get": {
    params: { "documentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "reviewedRevision": number | null; "currentRevision": number; "changed": boolean; "blocks": ({ "kind": "paragraph" | "bulletItem" | "quote"; "text": string; "change": "unchanged" | "removed" | "added" } | { "kind": "heading"; "level": number; "text": string; "change": "unchanged" | "removed" | "added" })[] }; headers: {  } };
    errorCode: "unauthorized" | "not_found" | "unavailable";
  };
  "student.declaration.get": {
    params: { "assignmentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "state": "none" | "draft" | "confirmed" | "stale" | "bound"; "submitted": boolean; "currentRevision": number | null; "version": number; "formText": string | null; "currentForm": { "formId": string; "formVersion": number; "formSha256": string; "text": string } | null; "draft": { "baseVersion": number; "revision": number; "form": { "formId": string; "formVersion": number; "formSha256": string }; "ownWork": { "confirmed": boolean }; "humanHelp": { "received": boolean; "entries": ({ "kind": "language" | "structure" | "sources" | "content" | "technical" | "other"; "text": string })[] }; "ai": { "use": "used" | "not_used" | null; "declaredTools": ({ "toolLabel": string; "purposeText": string; "phaseText": string })[]; "attachments": ({ "conversationId": string; "throughSeq": number; "messagesSha256": string })[]; "externalAttachmentIds": (string)[] }; "confirm": boolean } | null; "payload": { "declarationSchema": "ductura-declaration-v1"; "declarationId": string; "declarationVersion": number; "principalId": string; "assignmentId": string; "assignmentVersion": number; "documentId": string; "revision": number; "form": { "formId": string; "formVersion": number; "formSha256": string }; "ownWork": { "confirmed": true }; "humanHelp": { "received": boolean; "entries": ({ "kind": "language" | "structure" | "sources" | "content" | "technical" | "other"; "text": string })[] }; "ai": { "use": "used" | "not_used"; "declaredTools": ({ "toolLabel": string; "purposeText": string; "phaseText": string })[]; "recorded": ({ "aiTransferId": string; "aiTransferSha256": string })[]; "attachments": ({ "externalAttachmentId": string; "format": "application/pdf" | "text/plain"; "byteLength": number; "contentSha256": string; "reason": "external_upload" })[] }; "confirmedAt": string } | null; "declarationSha256": string | null; "uploads": ({ "externalAttachmentId": string; "format": "application/pdf" | "text/plain"; "byteLength": number; "contentSha256": string })[] }; headers: { "cache-control"?: string } };
    errorCode: "unauthorized" | "forbidden" | "not_found" | "unavailable";
  };
  "student.submission.get": {
    params: { "assignmentId": string };
    query: undefined;
    body: undefined;
    success: { status: 200; body: { "state": "none" } | { "state": "ceka"; "revision": number; "requestedAt": string } | { "state": "potvrdeno"; "receipt": { "payload": { "receiptSchema": "ductus-submission-receipt-v2"; "submissionId": string; "evidenceDomainId": string; "principalId": string; "assignmentId": string; "assignmentVersion": number; "documentId": string; "evidencePackageId": string; "revision": number; "artifactSha256": string; "evidenceHeadSegmentHash": string; "evidenceRecord": "continuous" | "with_gaps"; "requestedAt": string; "dueAt": string; "afterDeadline": boolean; "signedAt": string }; "payloadDigestSha256": string; "signature": { "algorithm": "Ed25519"; "keyId": string; "keyVersion": string; "signatureEncoding": "raw"; "signatureBase64Url": string } } }; headers: {  } };
    errorCode: "unauthorized" | "not_found" | "unavailable";
  };
};
