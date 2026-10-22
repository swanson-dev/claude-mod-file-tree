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

- **Tree:** click a folder to expand or collapse it; `.git`, `node_modules` and `.tmp` are hidden. Icons per file type (Unicode on the desktop app, Nerd Font elsewhere).
- **Git:** branch with ahead/behind, per-file status colors, `+N -N` on modified files, changed-file counts on folders, `↻` to refresh.
- **Search:** press `s` or `/`, type, Enter. Matches every tracked and untracked file, including folders you have not opened.
- **Claude activity:** files Claude reads (purple) or writes (orange) shimmer for 8 seconds and the tree expands to them. Reads count the Read tool and Bash readers (`cat`, `head`, `rg`, `grep`, `sed`, `find`, ...).
- **Git operations:** a footer shows what a Bash command is doing (committing, pushing, opening a PR, ...) and how it ended.
- **Columns:** the right column shows date, age or size (`Σ` button or `z`); folder sizes come from `du`.
- **Preview and diff:** `o`, Enter or a double-click shows a file in the pane (Markdown rendered); `d` shows the diff against HEAD for a file or folder, `d` again goes back to the file, `h`/`←` closes.
- **Selection:** click a file to select it; your next prompt gets `[Selected in file tree: path]` appended.

### Keys

Click the tree to focus it. `j`/`k` or `↓`/`↑` move, `l`/`→` expand, `h`/`←` collapse or go to the parent, `o`/Enter open, `d` diff, `r` refresh, `z` cycle the column, `g`/`G` first and last, `s` or `/` search.

## Settings

All in `/config` under file-tree: **Claude activity** (reads and writes, writes, reads, none), **Follow Claude**, **Open at start**, **Right column**, **Glyphs** (auto, nerd, plain), **Open with** (`preview`, or a command with `{path}`, run where the session runs), **Ignore** (extra names to hide).

## Limits

Opening a file in an editor or default app runs a command where the session runs, so in a cloud session it cannot reach your desktop; use the preview there. The tree and its colors assume a dark theme. There is no custom palette setting and the tree does not auto-scroll to the cursor beyond the pane's own scrolling.

## Development

```bash
claude plugin validate .
claude plugin test .
```

Inspired by [data-goblin/claude-code-filetree](https://github.com/data-goblin/claude-code-filetree) (MIT); no code is copied from it.
