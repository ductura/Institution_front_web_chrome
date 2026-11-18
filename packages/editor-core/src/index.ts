// editor-core (DAN-888, 888-1): public entry. Only the canonical document
// schema and its validation are here so far; later parts of the chain add the
// rest of the Ductus `src/editor` entry. json and jcs stay internal.
export * from "./domain/document/forbidden";
export * from "./domain/document/revision-zero";
export * from "./domain/document/schema";
export * from "./domain/document/snapshot";
export * from "./domain/document/validate";
