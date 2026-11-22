/**
 * English texts of the UI package's components (D-70, M11.5): the same
 * sections and keys as `uiMessagesHr` in `./catalogue.ts`. Words from the
 * forbidden vocabulary (Ductus PRODUCT §5) never appear here.
 */
export const uiMessagesEn = {
  diff: {
    label: "Text comparison",
    added: "Added",
    removed: "Removed",
    empty: "No changes.",
  },
  objectToolbar: {
    label: "Object actions",
    table: "Table",
    image: "Image",
    preview: "Preview",
    remove: "Remove",
  },
  previewDialog: {
    close: "Close",
    table: "Table preview",
    image: "Image preview",
  },
  sideShell: {
    menu: "Menu",
    home: {
      student: "Ductura, student home",
      teacher: "Ductura, teacher home",
      admin: "Ductura, institution home",
      none: "Ductura, home",
    },
  },
  searchableList: {
    search: "Search sources",
    results: "Sources",
    empty: "No sources yet.",
    noResults: "No sources match the search.",
    loading: "Loading sources…",
  },
  sourceForm: {
    add: "Add source", edit: "Edit source", save: "Save changes", cite: "Add and cite", cancel: "Cancel",
    library: "Bibliography only",
    type: "Source type", book: "Book", article: "Article", chapter: "Book chapter", web: "Web source",
    authors: "Authors", editors: "Editors", addAuthor: "Add author", addEditor: "Add editor",
    contributorType: "Author type", person: "Person", organization: "Institution or organisation",
    family: "Surname", given: "Given name", name: "Organisation name", acronym: "Acronym",
    remove: "Remove", author: "Author", editor: "Editor",
    title: "Title", year: "Year of publication", place: "Place of publication", publisher: "Publisher",
    journal: "Journal", volume: "Volume", issue: "Issue", pages: "Pages", bookTitle: "Book title",
    url: "Web address", accessed: "Date accessed", dateHint: "YYYY-MM-DD",
    required: "Fill in this field.", invalidText: "Check the characters and the length of the entry.",
    invalidYear: "Enter a year from 1000 to 9999.", invalidDate: "Enter a valid date as YYYY-MM-DD.",
    invalidUrl: "Enter a valid web address that starts with https:// or http://.",
  },
  timeline: {
    label: "Timeline",
    slider: "Writing step",
    previous: "Previous step",
    next: "Next step",
    play: "Start replay",
    pause: "Pause replay",
    speed: "Replay speed",
    empty: "No steps to replay.",
    step: (value: number, last: number) => `Step ${value} of ${last}`,
  },
  fingerprint: {
    copy: "Fingerprint to clipboard",
    copied: "The fingerprint is on the clipboard (64 characters, no spaces).",
    copyFailed: "Moving the fingerprint to the clipboard did not work.",
    notifications: "Fingerprint notices",
    close: "Close",
  },
  stateTag: {
    submitted: "Submitted",
    not_submitted: "Not submitted",
    late: "After the deadline",
    pending: "Awaiting confirmation",
    gap: "Gap in the record",
  },
  steps: ["Text", "Declaration", "Before submitting", "Submission", "Confirmation"],
  table: {
    ascending: "ascending",
    descending: "descending",
    sortedBy: "Sorted by column {column}, {direction}.",
    loading: "Loading…",
  },
};
