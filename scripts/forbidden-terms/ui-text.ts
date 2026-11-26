/**
 * Interface text that lives in `.ts` and `.json` modules outside locales/: the
 * Ductus catalogue copied into src/lib/i18n (Ductus 0cdb0f1f) and the label and
 * message modules of the copied front. Ported from Ductus
 * scripts/forbidden-terms/scan.ts at 0cdb0f1f (`UI_TEXT_MODULES`,
 * `isUiTextModule`, `extractUiText` in `catalogue` mode); the component and
 * metadata readings of JSX stay in Ductus until the screens need them here.
 *
 * In a module on the list every string value is read: literals, templates
 * (computed parts read as a space) and `+` chains (one text put together from
 * the parts, as well as every literal by itself). Object keys, the module
 * specifiers of imports and exports, and literal types are not text. Test
 * files and declaration files are never read.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

import { findForbiddenTerms, type ForbiddenTerm } from "./terms.ts";

export type UiText = Readonly<{ file: string; line: number; text: string }>;

export type UiTextFinding = UiText & Readonly<{ terms: readonly ForbiddenTerm[] }>;

/**
 * The modules that hold interface text, as globs over repository paths with
 * forward slashes. `**` stands for any number of directories, none included;
 * as the last segment it stands for everything below. This is the only list:
 * there are no exemptions per file or per finding.
 */
export const UI_TEXT_MODULES: readonly string[] = [
  // The Ductus message catalogue (messages.hr.ts, messages.en.ts, demo data).
  "src/lib/i18n/**",
  // Label and message modules wherever they live (packages/editor-core/src/sync/labels.ts,
  // packages/editor-core/src/serverSync/messages.ts).
  "**/labels.ts",
  "**/messages.ts",
  "**/copy.ts",
  // The Croatian message catalogues of the host screens (MEN-37).
  "**/messages.hr.ts",
  // The editor placeholder (Ductus src/editor/schema.ts).
  "packages/editor-core/src/editor/schema.ts",
];

/** Where `scanUiTextModules` looks; locales/ has its own scan (`scanLocales`). */
export const UI_TEXT_ROOTS: readonly string[] = ["src", "packages"];

const SKIPPED_DIRS = new Set(["node_modules", "dist", ".next", "test-results", "playwright-report"]);
const NOT_READ = /\.(?:test|spec)\.[cm]?tsx?$|\.d\.[cm]?ts$/;
const READ = /\.(?:[cm]?tsx?|json)$/;

// Path segments are compared literally; no RegExp is built from a glob.
function matchesSegments(pattern: readonly string[], file: readonly string[]): boolean {
  if (pattern.length === 0) return file.length === 0;
  const [head, ...rest] = pattern;
  if (head !== "**") return file.length > 0 && file[0] === head && matchesSegments(rest, file.slice(1));
  if (rest.length === 0) return file.length > 0;
  return file.some((_, skipped) => matchesSegments(rest, file.slice(skipped)));
}

const UI_TEXT_PATTERNS = UI_TEXT_MODULES.map((glob) => glob.split("/"));

/** Whether `file` (repository path with forward slashes) is on `UI_TEXT_MODULES` and is a module the scan reads. */
export function isUiTextModule(file: string): boolean {
  if (!READ.test(file) || NOT_READ.test(file)) return false;
  const segments = file.split("/");
  return UI_TEXT_PATTERNS.some((pattern) => matchesSegments(pattern, segments));
}

const isPlainString = (node: ts.Node): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral =>
  ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);

/** The operands of a `+` chain, left to right; any other expression is its own single operand. */
function operands(expression: ts.Expression): ts.Expression[] {
  if (ts.isParenthesizedExpression(expression)) return operands(expression.expression);
  if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return [...operands(expression.left), ...operands(expression.right)];
  }
  return [expression];
}

const isPlusChain = (node: ts.Node): node is ts.BinaryExpression =>
  ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken;

/** A key of an object literal, an interface or a type literal, written as a string. */
function isKey(node: ts.Node): boolean {
  const parent = node.parent;
  return (
    ((ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent) || ts.isMethodDeclaration(parent)) && parent.name === node) ||
    (ts.isComputedPropertyName(parent) && isPlainString(node))
  );
}

/**
 * The interface text of one module, in source order. `catalogue` is the only
 * kind read here: every string value of the module. A JSON file is read the
 * same way, so its keys are skipped and its string values are text.
 */
export function extractUiText(file: string, content: string, kind: "catalogue"): UiText[] {
  if (kind !== "catalogue") throw new Error(`unknown kind ${String(kind)}`);
  const source = file.endsWith(".json")
    ? ts.parseJsonText(file, content)
    : ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const texts: UiText[] = [];
  const collect = (node: ts.Node, text: string): void => {
    texts.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, text });
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isImportTypeNode(node) || ts.isLiteralTypeNode(node)) return;
    if (ts.isExternalModuleReference(node)) return;
    if (isPlainString(node)) {
      if (!isKey(node)) collect(node, node.text);
      return;
    }
    if (ts.isTemplateExpression(node)) {
      collect(node, [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(" "));
    }
    if (isPlusChain(node) && !isPlusChain(node.parent)) {
      const parts = operands(node);
      if (parts.length > 1 && parts.some(isPlainString)) {
        collect(node, parts.map((part) => (isPlainString(part) ? part.text : " ")).join(""));
      }
    }
    ts.forEachChild(node, visit);
  };
  // A JSON source keeps its node parents only when they are set while parsing.
  if (file.endsWith(".json")) setParents(source);
  visit(source);
  return texts;
}

function setParents(node: ts.Node): void {
  ts.forEachChild(node, (child) => {
    (child as { parent: ts.Node }).parent = node;
    setParents(child);
  });
}

/** Every file below `root` that `isUiTextModule` takes, as repository paths in sorted order. */
export function findUiTextModules(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const file = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name)) walk(file);
      } else if (entry.isFile() && isUiTextModule(file)) {
        found.push(file);
      }
    }
  };
  for (const dir of UI_TEXT_ROOTS) walk(dir);
  return found.sort();
}

/** Dictionary entries in the interface text of every module on `UI_TEXT_MODULES` below `root`. */
export function scanUiTextModules(root: string): { files: readonly string[]; findings: readonly UiTextFinding[] } {
  const files = findUiTextModules(root);
  const findings: UiTextFinding[] = [];
  for (const file of files) {
    for (const text of extractUiText(file, readFileSync(path.join(root, file), "utf8"), "catalogue")) {
      const terms = findForbiddenTerms(text.text);
      if (terms.length > 0) findings.push({ ...text, terms });
    }
  }
  return { files, findings };
}
