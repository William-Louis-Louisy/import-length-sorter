# Changelog

## [1.2.0] - 2026-05-28

### Changed

- Reworked global sort: single-line and multi-line imports are now sorted together in one pass
- Sort key for multi-line imports is the length of the last line (`} from '...';`)
  instead of the collapsed single-line length

### Added

- Items inside multi-line imports are now sorted: regular items first (short → long),
  then `type` items (short → long)

## [1.1.0] - 2026-05-22

### Fixed

- Fixed multi-line import parsing using proper brace depth tracking

## [1.0.0] - 2026-05-22

### Added

- Sort imports by line length (ascending or descending)
- Keyboard shortcut `Ctrl+Alt+I` / `Cmd+Alt+I`
- Sort on save option
- Group separator between node_modules and relative imports
- Support for JavaScript, TypeScript, Python, Dart, CSS/SCSS
- Multi-line import handling
- Right-click context menu entry
