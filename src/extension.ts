import * as vscode from "vscode";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImportStatement {
  /** All raw lines belonging to this statement */
  lines: string[];
  /** Collapsed single-line version used for length measurement & relative detection */
  collapsed: string;
  /** Whether this is a relative import (starts with . or ..) */
  isRelative: boolean;
}

interface ImportBlock {
  startLine: number;
  endLine: number;
  statements: ImportStatement[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** True if this line begins a new import statement */
function isImportStart(line: string): boolean {
  const t = line.trimStart();
  return (
    /^import[\s{*]/.test(t) ||   // JS/TS: import ..., import {, import *
    /^import\s*['"]/.test(t) ||  // Dart/side-effect: import "..."
    /^from\s/.test(t) ||         // Python: from x import y
    /^@import\s/.test(t) ||      // CSS/SCSS
    /^require\s*\(/.test(t)      // CommonJS top-level
  );
}

/**
 * Parse all lines of a document into ImportBlocks.
 * A block is a maximal run of import statements with no blank lines between them.
 * Multi-line imports (open braces not yet closed) are tracked via brace depth.
 */
function findImportBlocks(docLines: string[]): ImportBlock[] {
  const blocks: ImportBlock[] = [];
  let i = 0;

  while (i < docLines.length) {
    // Skip non-import lines
    if (!isImportStart(docLines[i])) { i++; continue; }

    // We found the start of an import block
    const blockStartLine = i;
    const statements: ImportStatement[] = [];

    // Keep consuming statements until we hit a blank line or a non-import non-continuation line
    while (i < docLines.length) {
      const line = docLines[i];

      // Blank line → block ends
      if (line.trim() === "") break;

      // Not a continuation and not a new import → block ends
      // (handles cases like `const x = ...` right after imports with no blank line)
      if (!isImportStart(line) && statements.length === 0) break;

      // If we're between statements (depth=0) and hit a non-import → block ends
      // (except when we're inside a multi-line import)

      // --- Collect lines for ONE statement ---
      const stmtLines: string[] = [];
      let depth = 0;        // brace depth
      let parenDepth = 0;   // paren depth  (for require())
      let complete = false;

      while (i < docLines.length) {
        const l = docLines[i];

        // Blank line mid-statement should not happen in valid code, but guard anyway
        if (l.trim() === "" && stmtLines.length > 0 && depth === 0) break;

        // If we're at depth 0 and this line starts a NEW import (not the first line),
        // stop — this line belongs to the next statement
        if (stmtLines.length > 0 && depth === 0 && parenDepth === 0 && isImportStart(l)) break;

        stmtLines.push(l);
        i++;

        // Count braces / parens to track multi-line constructs
        for (const ch of l) {
          if (ch === "{") depth++;
          else if (ch === "}") depth--;
          else if (ch === "(") parenDepth++;
          else if (ch === ")") parenDepth--;
        }

        // Statement is complete when balanced and the line ends with ; or a closing quote
        if (depth <= 0 && parenDepth <= 0) {
          const trimmed = l.trimEnd();
          if (
            trimmed.endsWith(";") ||
            trimmed.endsWith("'") ||
            trimmed.endsWith('"') ||
            trimmed.endsWith("`")
          ) {
            complete = true;
            break;
          }
        }
      }

      if (stmtLines.length === 0) break;

      const collapsed = stmtLines.map(l => l.trim()).join(" ").replace(/\s+/g, " ");
      const isRelative = /from\s+['"]\.|import\s+['"]\./.test(collapsed);

      statements.push({ lines: stmtLines, collapsed, isRelative });

      if (!complete && depth <= 0 && parenDepth <= 0) {
        // Incomplete statement (e.g. no semicolon) — still added, stop the block
        break;
      }
    }

    if (statements.length > 0) {
      const endLine = blockStartLine + statements.reduce((sum, s) => sum + s.lines.length, 0) - 1;
      blocks.push({ startLine: blockStartLine, endLine, statements });
    }
  }

  return blocks;
}

// ─── Sorting ──────────────────────────────────────────────────────────────────

type Order = "asc" | "desc";

function sortStatements(stmts: ImportStatement[], order: Order): ImportStatement[] {
  return [...stmts].sort((a, b) => {
    const diff = a.collapsed.length - b.collapsed.length;
    return order === "asc" ? diff : -diff;
  });
}

function sortBlock(block: ImportBlock, order: Order, groupSeparator: boolean): string | null {
  const { statements } = block;
  if (statements.length <= 1) return null;

  let sorted: ImportStatement[];

  if (groupSeparator) {
    const node = statements.filter(s => !s.isRelative);
    const relative = statements.filter(s => s.isRelative);
    const sortedNode = sortStatements(node, order);
    const sortedRelative = sortStatements(relative, order);
    sorted = [...sortedNode];
    if (sortedNode.length > 0 && sortedRelative.length > 0) {
      // Insert a blank-line separator as a fake statement
      sorted.push({ lines: [""], collapsed: "", isRelative: false });
    }
    sorted.push(...sortedRelative);
  } else {
    sorted = sortStatements(statements, order);
  }

  const newText = sorted.map(s => s.lines.join("\n")).join("\n");
  const oldText = statements.map(s => s.lines.join("\n")).join("\n");

  return newText !== oldText ? newText : null;
}

// ─── Core ─────────────────────────────────────────────────────────────────────

async function sortImportsInEditor(
  editor: vscode.TextEditor,
  order: Order,
  groupSeparator: boolean
): Promise<number> {
  const doc = editor.document;
  const allLines = Array.from({ length: doc.lineCount }, (_, i) => doc.lineAt(i).text);

  const blocks = findImportBlocks(allLines);
  if (blocks.length === 0) return 0;

  let count = 0;
  await editor.edit(builder => {
    for (const block of blocks) {
      const newText = sortBlock(block, order, groupSeparator);
      if (newText !== null) {
        const range = new vscode.Range(
          new vscode.Position(block.startLine, 0),
          new vscode.Position(block.endLine, allLines[block.endLine].length)
        );
        builder.replace(range, newText);
        count++;
      }
    }
  });

  return count;
}

// ─── Extension entry points ───────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {

  const sortAsc = vscode.commands.registerCommand("importLengthSorter.sort", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const config = vscode.workspace.getConfiguration("importLengthSorter");
    const n = await sortImportsInEditor(editor, "asc", config.get("addBlankLineBetweenGroups", false));
    vscode.window.showInformationMessage(
      n > 0 ? `✅ ${n} bloc(s) trié(s) (croissant).` : "ℹ️ Imports déjà triés."
    );
  });

  const sortDesc = vscode.commands.registerCommand("importLengthSorter.sortDesc", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const config = vscode.workspace.getConfiguration("importLengthSorter");
    const n = await sortImportsInEditor(editor, "desc", config.get("addBlankLineBetweenGroups", false));
    vscode.window.showInformationMessage(
      n > 0 ? `✅ ${n} bloc(s) trié(s) (décroissant).` : "ℹ️ Imports déjà triés."
    );
  });

  const onSave = vscode.workspace.onWillSaveTextDocument(async event => {
    const config = vscode.workspace.getConfiguration("importLengthSorter");
    if (!config.get("sortOnSave", false)) return;
    const editor = vscode.window.visibleTextEditors.find(e => e.document === event.document);
    if (!editor) return;
    await sortImportsInEditor(
      editor,
      config.get("order", "asc") as Order,
      config.get("addBlankLineBetweenGroups", false)
    );
  });

  context.subscriptions.push(sortAsc, sortDesc, onSave);
}

export function deactivate() {}
