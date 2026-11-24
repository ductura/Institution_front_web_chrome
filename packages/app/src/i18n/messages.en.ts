import type { ProfileMessages } from "./messages.hr";

/**
 * English texts of the app's own screens (D-70, M11.5): the same keys as the
 * Croatian tables next to the host's screens (`./catalogue.ts` puts them side
 * by side). Words from the forbidden vocabulary (Ductus PRODUCT §5) never
 * appear here.
 */
export const profileEn: ProfileMessages = {
  title: "Profile settings",
  intro: "These settings apply to your account only. Changing the language does not ask you to sign in again.",
  open: "Profile settings",
  language: {
    heading: "Interface language",
    label: "Language",
    hint: "The language of the screens you read. The language you write your work in is set in the assignment and is not changed here.",
    options: { hr: "Hrvatski", en: "English" },
    save: "Save language",
    saving: "Saving the language…",
    saved: "The interface language is saved on the server.",
    failed: "The language was not saved on the server. Please try again.",
    signedOut: "Your sign-in has expired. Sign in again through AAI@EduHr, then save the language.",
    loadFailed: "The language kept on the server cannot be read right now. The default language is shown.",
  },
  format: {
    heading: "Dates and numbers",
    hint: "Dates and numbers follow the interface language; the time is always Zagreb time.",
    date: "Date and time",
    number: "Number",
  },
  name: {
    heading: "Name display",
    label: "Name in the interface",
    hint: "Your name comes from signing in through AAI@EduHr. It is changed in your institution's system, not here.",
    none: "No name was sent at sign-in.",
  },
  notifications: {
    heading: "In-app notifications",
    hint: "Notifications are shown only in Ductura. Nothing is sent by email.",
    kinds: {
      comment: "New comment on a work",
      assignmentVersion: "New version of an assignment",
      submission: "Submission recorded",
    },
    save: "Save notifications",
    saving: "Saving notifications…",
    saved: "Notification settings are saved on the server.",
    failed: "Notification settings were not saved on the server. Please try again.",
    loading: "Loading notification settings…",
    unavailable: "Notification settings are not available on the institution server yet.",
  },
};

export const pageLabelsEn = {
  originComposition: "Origin of the text",
  studentInterview: "Conversation about the work",
  consultations: "Consultations",
  versionComparison: "Version comparison",
  processSummary: "Process summary",
  interviewPreparation: "Interview preparation",
  workReview: "Review of the work",
  studentDataExport: "Student data export",
  studentDataDownload: "Export of my data",
  merlinExport: "Export for Merlin",
  assignmentSubmissions: "Assignment submissions",
  courseStudents: "Student list",
  courseAggregate: "Course summary",
  receiptCheck: "Receipt check",
  originThresholds: "Thresholds per origin kind",
  pilotMetrics: "Pilot measures",
  actionLog: "Log of actions",
  problemReports: "Problem reports",
  facultySettings: "Faculty settings",
  facultyAssistant: "Assistant at the faculty",
  myRights: "My rights",
};

export const accessDeniedEn = {
  pageTitle: "No access",
  title: { denied: "You do not have access to this view", expired: "Your sign-in has expired", signedOut: "Sign-in needed" },
  body: {
    denied: "This view is not available with your account. If you think it should be, contact your institution's administrator.",
    expired: "Your sign-in expired after a long time without activity. Sign in again through AAI@EduHr and carry on where you left off.",
    signedOut: "Sign in through AAI@EduHr to open this view.",
  },
  signIn: "Sign in through AAI@EduHr",
  heldNote: "Input you had not sent is still saved on this device. You can continue it after signing in.",
  home: "Back to the start",
};

export const hostTextEn = {
  loading: "Loading…",
  signingIn: "Taking you to sign-in through AAI@EduHr…",
  sessionUnavailableTitle: "Your sign-in could not be checked",
  sessionUnavailable: "The institution server is not responding right now. Please try again in a few minutes.",
  pending: "This view is not connected to the institution server yet.",
  noRole: "This account has no role at the institution yet. Roles are given by the institution administrator.",
  signInRedirecting: "Taking you to AAI@EduHr",
  signInNoRoleTitle: "Signed in",
  signInNoRoleBody: "This account has no role yet, so your space cannot be opened.",
  signOutFailed: "Signing out did not work. Please try again.",
  signIn: "Sign in",
  deadlineExtensions: "Deadline extension",
  mentorshipRequest: "Mentorship request",
};

export const institutionEn = {
  overview: "The institution overview is not available right now.",
  users: "The list of users and roles is not available right now.",
  courses: "The list of courses and academic years is not available right now.",
  rules: "The faculty rules view is not available right now.",
};

export const noticeReadEn = {
  sending: "Recording that the notice was opened…",
  read: "The server has recorded that the notice was opened.",
  failed: "The server did not confirm that opening the notice was recorded.",
  stale: "A new version of the assignment has been published. Load it and read the new notice.",
};

export const teacherWorkEn = {
  loading: "Checking access to the work…",
  unavailable: "Access to the work cannot be checked right now.",
  liveUnavailable: "The text of the work is not available right now. Ductura is trying to reconnect.",
};

export const teacherAiLabelsEn = {
  title: "Use of AI",
  confirmed: "Declaration confirmed",
  noUse: "The student declared that they did not use AI tools. No use of the Assistant is recorded in the work and no conversations are attached.",
  aiDisabled: "The assignment does not allow the built-in Assistant. The student declared the use of an external tool.",
  pendingTag: "Completion pending",
  pending:
    "The declaration of AI use could not be put together at submission because of a technical error in Ductura. The declaration and the attached conversations will appear here once the student completes the declaration. The submission and the work are available as usual.",
  loading: "Loading the declaration and the attached conversations.",
  error: "The declaration and the attached conversations cannot be loaded right now.",
  errorNote: "This is an error in the view. The submission, the declaration and the attached conversations have not changed.",
  retry: "Try again",
  usesCaption: "Student's declaration",
  colPurpose: "Purpose",
  colProvider: "Provider and model",
  colPhase: "Phase",
  transfersHeading: "Text moved into the work from the Assistant",
  transfersNote: "The list shows text that is in the submitted version of the work.",
  attachedHeading: "Attached conversations",
  transferTag: "required",
  studentAddedTag: "attached by the student",
  attachedNote:
    "Required: text from the conversation was moved into the work. Attached by the student: a conversation without a transfer, attached by the student's choice. The student did not attach the other conversations and they are not shown.",
  externalHeading: "External tool, declared",
  externalTag: "declared",
  externalNote: "The external conversation was attached by the student. Ductura did not record it, cannot check it and does not compare the text of the work with it.",
  open: "Open",
  versionNote: "The version of the conversation as the student reviewed and confirmed it with the declaration. Read only.",
  student: "Student",
  back: "Back to the use of AI",
  sameView: "The student sees this same view in their submission.",
};
