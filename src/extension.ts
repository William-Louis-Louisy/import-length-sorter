import * as vscode from "vscode";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImportStatement {
  lines: string[];
  isMultiLine: boolean;
  /** Sort key: full line for single-line, last line for multi-line */
  sortKey: string;
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

function isImportStart(line: string): boolean {
  const t = line.trimStart();
  return (
    /^import[\s{*]/.test(t) ||
    /^import\s*['"]/.test(t) ||
    /^from\s/.test(t) ||
    /^@import\s/.test(t) ||
    /^require\s*\(/.test(t)
  );
}

/**
 * Parse document lines into groups of ImportStatements.
 * A group is a maximal run of imports with no blank lines between them.
 * Multi-line imports are tracked via brace/paren depth.
 */
function findImportGroups(
  docLines: string[],
): { startLine: number; statements: ImportStatement[] }[] {
  const groups: { startLine: number; statements: ImportStatement[] }[] = [];
  let i = 0;

  while (i < docLines.length) {
    if (!isImportStart(docLines[i])) {
      i++;
      continue;
    }

    const groupStart = i;
    const statements: ImportStatement[] = [];

    while (i < docLines.length) {
      const line = docLines[i];
      if (line.trim() === "") break;
      if (!isImportStart(line) && statements.length === 0) break;

      // Collect lines for one statement
      const stmtLines: string[] = [];
      let depth = 0;
      let parenDepth = 0;
      let complete = false;

      while (i < docLines.length) {
        const l = docLines[i];
        if (l.trim() === "" && stmtLines.length > 0 && depth === 0) break;
        if (
          stmtLines.length > 0 &&
          depth === 0 &&
          parenDepth === 0 &&
          isImportStart(l)
        )
          break;

        stmtLines.push(l);
        i++;

        for (const ch of l) {
          if (ch === "{") {
            depth++;
          } else if (ch === "}") {
            depth--;
          } else if (ch === "(") {
            parenDepth++;
          } else if (ch === ")") {
            parenDepth--;
          }
        }

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

      const isMultiLine = stmtLines.length > 1;
      // Sort key: for multi-line = last line (the `} from '...';`), for single = full line
      const sortKey = isMultiLine
        ? stmtLines[stmtLines.length - 1]
        : stmtLines[0];

      statements.push({ lines: stmtLines, isMultiLine, sortKey });

      if (!complete && depth <= 0 && parenDepth <= 0) break;
    }

    if (statements.length > 0) {
      groups.push({ startLine: groupStart, statements });
    }
  }

  return groups;
}

// ─── Sort items inside a multi-line import ────────────────────────────────────

/**
 * Given a multi-line import statement, sort its named items:
 * - Non-type items first, ascending by trimmed length
 * - Type items after, ascending by trimmed length
 * Preserves the `import {` opening line, `} from '...';` closing line, and indentation.
 */
function sortMultiLineItems(stmt: ImportStatement): ImportStatement {
  if (!stmt.isMultiLine) return stmt;

  const lines = stmt.lines;
  const openLine = lines[0]; // `import {`
  const closeLine = lines[lines.length - 1]; // `} from '...';`
  const itemLines = lines.slice(1, lines.length - 1);

  if (itemLines.length === 0) return stmt;

  // Detect indentation from the first item line
  const indentMatch = itemLines[0].match(/^(\s+)/);
  const indent = indentMatch ? indentMatch[1] : "  ";

  // Parse items (each line is one item, possibly with trailing comma)
  const items = itemLines.map((l) => l.trim().replace(/,$/, ""));

  const typeItems = items.filter((item) => /^type\s/.test(item));
  const normalItems = items.filter((item) => !/^type\s/.test(item));

  normalItems.sort((a, b) => a.length - b.length);
  typeItems.sort((a, b) => a.length - b.length);

  const sortedItems = [...normalItems, ...typeItems];

  // Rebuild lines with original indentation and trailing commas
  const newItemLines = sortedItems.map((item, idx) => {
    const isLast = idx === sortedItems.length - 1;
    return `${indent}${item}${isLast ? "," : ","}`;
  });

  const newLines = [openLine, ...newItemLines, closeLine];
  const newSortKey = closeLine;

  return { lines: newLines, isMultiLine: true, sortKey: newSortKey };
}

// ─── Sort a group ─────────────────────────────────────────────────────────────

type Order = "asc" | "desc";

function sortGroup(
  statements: ImportStatement[],
  order: Order,
  groupSeparator: boolean,
): string | null {
  if (statements.length <= 1) return null;

  // First sort items inside each multi-line import
  const processed = statements.map((s) =>
    s.isMultiLine ? sortMultiLineItems(s) : s,
  );

  // Then sort all statements by their sort key length
  const sorted = [...processed].sort((a, b) => {
    const diff = a.sortKey.trimEnd().length - b.sortKey.trimEnd().length;
    return order === "asc" ? diff : -diff;
  });

  // Optional: separate node_modules from relative imports
  let final: ImportStatement[];
  if (groupSeparator) {
    const isRelative = (s: ImportStatement) =>
      /from\s+['"]\.|import\s+['"]\./.test(s.lines.join(" "));
    const node = sorted.filter((s) => !isRelative(s));
    const relative = sorted.filter((s) => isRelative(s));
    final = [
      ...node,
      ...(node.length > 0 && relative.length > 0
        ? [{ lines: [""], isMultiLine: false, sortKey: "" }]
        : []),
      ...relative,
    ];
  } else {
    final = sorted;
  }

  const newText = final.map((s) => s.lines.join("\n")).join("\n");
  const oldText = statements.map((s) => s.lines.join("\n")).join("\n");

  return newText !== oldText ? newText : null;
}

// ─── Core ─────────────────────────────────────────────────────────────────────

async function sortImportsInEditor(
  editor: vscode.TextEditor,
  order: Order,
  groupSeparator: boolean,
): Promise<number> {
  const doc = editor.document;
  const allLines = Array.from(
    { length: doc.lineCount },
    (_, i) => doc.lineAt(i).text,
  );

  const groups = findImportGroups(allLines);
  if (groups.length === 0) return 0;

  let count = 0;
  await editor.edit((builder) => {
    for (const group of groups) {
      const newText = sortGroup(group.statements, order, groupSeparator);
      if (newText !== null) {
        const totalLines = group.statements.reduce(
          (sum, s) => sum + s.lines.length,
          0,
        );
        const endLine = group.startLine + totalLines - 1;
        const range = new vscode.Range(
          new vscode.Position(group.startLine, 0),
          new vscode.Position(endLine, allLines[endLine].length),
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
  const sortAsc = vscode.commands.registerCommand(
    "importLengthSorter.sort",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const config = vscode.workspace.getConfiguration("importLengthSorter");
      const n = await sortImportsInEditor(
        editor,
        "asc",
        config.get("addBlankLineBetweenGroups", false),
      );
      vscode.window.showInformationMessage(
        n > 0
          ? `✅ ${n} bloc(s) trié(s) (croissant).`
          : "ℹ️ Imports déjà triés.",
      );
    },
  );

  const sortDesc = vscode.commands.registerCommand(
    "importLengthSorter.sortDesc",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const config = vscode.workspace.getConfiguration("importLengthSorter");
      const n = await sortImportsInEditor(
        editor,
        "desc",
        config.get("addBlankLineBetweenGroups", false),
      );
      vscode.window.showInformationMessage(
        n > 0
          ? `✅ ${n} bloc(s) trié(s) (décroissant).`
          : "ℹ️ Imports déjà triés.",
      );
    },
  );

  const onSave = vscode.workspace.onWillSaveTextDocument(async (event) => {
    const config = vscode.workspace.getConfiguration("importLengthSorter");
    if (!config.get("sortOnSave", false)) return;
    const editor = vscode.window.visibleTextEditors.find(
      (e) => e.document === event.document,
    );
    if (!editor) return;
    await sortImportsInEditor(
      editor,
      config.get("order", "asc") as Order,
      config.get("addBlankLineBetweenGroups", false),
    );
  });

  context.subscriptions.push(sortAsc, sortDesc, onSave);
}

export function deactivate() {}
