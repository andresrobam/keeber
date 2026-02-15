# Keeber

Client-only web app for turning Ergogen YAML into a full keyboard layout, preview, and firmware outputs.

## What it does

- Parse Ergogen YAML into a layout model (keys, matrix, MCU pins).
- Show an SVG layout preview with zone/column/row geometry.
- Edit layers and assign key bindings.
- Generate ZMK and QMK outputs.
- Save/load projects as versioned JSON.

## Getting started

```bash
npm install
npm run dev
```

Open the dev server URL and load an Ergogen YAML file.

## Outputs

- ZMK: `keymap.keymap` and `config.overlay`
- QMK: `keymap.c` and `info.json`

## Parsing notes

- Zones, columns, rows, anchors, stagger, and spread are supported.
- Mirroring is handled in the parser.
- `key.origin` and `key.splay` is currently ignored.
