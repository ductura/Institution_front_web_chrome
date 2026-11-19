// Thin adapter: citation style is already in the front's src/domain/citation
// (verbatim from Ductus, DAN-991); bibliography.ts needs document/schema, so
// it lives here and reads the rest from there instead of keeping a copy.
export * from "../../../../../src/domain/citation/style";
