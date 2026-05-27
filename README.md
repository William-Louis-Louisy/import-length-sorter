# Import Length Sorter

A VSCode extension that sorts your import statements by line length — keeping your code visually clean and consistent.

## Features

- **Sort ascending** (shortest → longest) via `Ctrl+Alt+I` / `Cmd+Alt+I`
- **Sort descending** (longest → shortest) via the command palette
- **Sort on save** (optional, disabled by default)
- **Multi-language support**: JavaScript, TypeScript, Python, Dart, CSS/SCSS
- **Multi-line imports** are handled correctly (curly-brace imports spanning several lines)
- **Group separator** option: adds a blank line between node_modules and relative imports

## Usage

### Via keyboard shortcut
- `Ctrl+Alt+I` (Windows/Linux) or `Cmd+Alt+I` (Mac) — sorts ascending

### Via command palette
Open the Command Palette (`Ctrl+Shift+P`) and type:
- `Sort Imports by Length` — ascending order
- `Sort Imports by Length (Descending)` — descending order

### Via right-click context menu
Right-click in any editor → **Sort Imports by Length**

## Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `importLengthSorter.sortOnSave` | boolean | `false` | Auto-sort imports on file save |
| `importLengthSorter.order` | `"asc"` \| `"desc"` | `"asc"` | Default sort order when using sort-on-save |
| `importLengthSorter.addBlankLineBetweenGroups` | boolean | `false` | Add a blank line between node_modules and relative imports |

## Examples

### Before
```ts
import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { MyComponent } from "./components/MyComponent";
import type { User } from "./types";
```

### After (ascending)
```ts
import axios from "axios";
import type { User } from "./types";
import { MyComponent } from "./components/MyComponent";
import { useState, useEffect, useCallback } from "react";
```

## Installation (development)

```bash
# 1. Install dependencies
npm install

# 2. Compile TypeScript
npm run compile

# 3. Press F5 in VSCode to launch the Extension Development Host

# 4. (Optional) Package as .vsix
npm run package
```

## Supported languages

The extension recognizes imports in:
- **JavaScript / TypeScript** — `import ... from "..."` and `require(...)`
- **Python** — `import x` / `from x import y`
- **Dart** — `import "...";`
- **CSS / SCSS** — `@import "..."`
