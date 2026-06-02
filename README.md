# Import Length Sorter

A VSCode extension that sorts import statements by line length — keeping your codebase
visually consistent and easy to scan.

## How it works

All imports are sorted together in a single pass using the following rules:

- **Single-line import** → sorted by the length of the full line
- **Multi-line import** → sorted by the length of its last line (`} from '...';`)
- **Items inside multi-line imports** → regular items first (short → long),
  then `type` items (short → long)

### Example

**Before**
```ts
import { auth } from '@/auth';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import {
  getPrimitiveColorTokenAliasOptions,
  createTokenRows,
  type TokenRowData,
} from '@/features/tokens/tokens-editor.utils';
```

**After**
```ts
import { auth } from '@/auth';
import { Link } from '@/i18n/navigation';
import {
  createTokenRows,
  getPrimitiveColorTokenAliasOptions,
  type TokenRowData,
} from '@/features/tokens/tokens-editor.utils';
import { getTranslations } from 'next-intl/server';
```

## Usage

| Method | Action |
|---|---|
| `Ctrl+Alt+I` / `Cmd+Alt+I` | Sort ascending (short → long) |
| Command Palette | `Sort Imports by Length` / `Sort Imports by Length (Descending)` |
| Right-click | `Sort Imports by Length` in the context menu |

## Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `importLengthSorter.sortOnSave` | boolean | `false` | Automatically sort imports on save |
| `importLengthSorter.order` | `"asc"` \| `"desc"` | `"asc"` | Default order used when sorting on save |
| `importLengthSorter.addBlankLineBetweenGroups` | boolean | `false` | Add a blank line between node_modules and relative imports |

## Supported languages

JavaScript, TypeScript, Python, Dart, CSS, SCSS

## Installation

Search for **Import Length Sorter** in the VSCode Extensions panel, or install via:

```bash
code --install-extension 221-bakerscript.import-length-sorter
```
