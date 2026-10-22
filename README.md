# claude-mod-file-tree

A file tree pane for Claude Code, written as a mod. It shows the working directory beside the chat, with git status, search, and highlights for the files Claude reads and writes. It draws with the shared elements, so it targets the desktop app and any surface that docks panes.

![type](https://img.shields.io/badge/type-mod-6f42c1) ![license](https://img.shields.io/badge/license-MIT-green)

## Install

```text
/plugin marketplace add swanson-dev/claude-mod-file-tree
/plugin install file-tree@claude-mod-file-tree
```

`/file-tree` opens (and refreshes) the pane; it also opens when a session starts.

## Features

- Click a folder to expand or collapse it; `.git`, `node_modules` and `.tmp` are hidden.
- Git branch with ahead/behind, per-file status colors, `+N -N` on modified files, changed-file counts on folders, and a `↻` refresh button.
- Search box filtering every tracked and untracked file, including folders you have not opened.
- Files Claude reads (purple) or edits and writes (orange) glow for 8 seconds, and the tree expands to them.
- Click a file to select it; your next prompt gets `[Selected in file tree: path]` appended.

## Not included

Keyboard navigation, animated shimmer, icons, size column, opening files, diff view, git-operation status, reads detected from Bash commands, and settings.

## Development

```bash
claude plugin validate .
claude plugin test .
```

Inspired by [data-goblin/claude-code-filetree](https://github.com/data-goblin/claude-code-filetree) (MIT); no code is copied from it.
