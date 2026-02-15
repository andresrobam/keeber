# AGENTS.md

## Project overview
Client-only web app for configuring custom keyboards from Ergogen YAML.
- Parses Ergogen YAML into a layout model (keys, matrix, MCU pins).
- UI: SVG layout preview, layer editor, key binding assignments.
- Generates ZMK and QMK outputs.
- Save/load project state via JSON.

## Working directory
- The root directory is the working directory
- Example YAML config files might be placed in the `example` folder.

## How to run
- Install deps: `npm install`.
- Start dev server: `npm run dev`.

## Data flow
- YAML is parsed in `src/App.jsx`.
- Key parsing includes:
  - Zones, columns, rows, anchor refs, stagger, spread.
  - Mirroring handled in the parser.
  - `key.origin` and `key.splay` is currently ignored.
- Rendering flips Y at render time (not during parsing).

## Outputs
- ZMK: `keymap.keymap` + `config.overlay`.
- QMK: `keymap.c` + `info.json`.

## Save/load format
- Save file: `keyboard-config.kb.json`.
- Contains `parsed`, `layers`, and selection state.
- Versioned schema with `version: 1`.

## Known decisions
- No symmetry on mirrored halves (left/right independent).
- Skipped keys are preserved in layout math but hidden by default.
- “Show skipped keys” toggle reveals ghost keys for debugging.

## Style & constraints
- Keep it client-only (no backend).
- Prefer small, incremental UX changes.
- Avoid adding heavy deps unless necessary.

## Quick validation
- Upload example YAML and confirm:
  - Matrix + thumbfan alignment.
  - Stagger between farpinky and pinky.
  - Mirror duplicates show as independent.
