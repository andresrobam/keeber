import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import yaml from 'js-yaml'
import './App.css'
import { KEY_GROUPS } from './keyRegistry'

const DEFAULT_U = 19.05

const KEY_LABELS = {
  ESC: 'Esc',
  ESCAPE: 'Esc',
  TAB: 'Tab',
  ENTER: 'Ent',
  RETURN: 'Ent',
  SPACE: 'Spc',
  BACKSPACE: 'Bksp',
  BSPC: 'Bksp',
  DELETE: 'Del',
  DEL: 'Del',
  SHIFT: 'Shift',
  LSHIFT: 'Shift',
  RSHIFT: 'Shift',
  LSFT: 'Shift',
  RSFT: 'Shift',
  CONTROL: 'Ctrl',
  CTRL: 'Ctrl',
  LCTRL: 'Ctrl',
  RCTRL: 'Ctrl',
  LCTL: 'Ctrl',
  RCTL: 'Ctrl',
  ALT: 'Alt',
  LALT: 'Alt',
  RALT: 'Alt',
  GUI: 'Gui',
  LGUI: 'Gui',
  RGUI: 'Gui',
  CMD: 'Cmd',
  LCMD: 'Cmd',
  RCMD: 'Cmd',
  CAPS: 'Caps',
  CAPSLOCK: 'Caps',
  HOME: 'Home',
  END: 'End',
  PGUP: 'PgUp',
  PAGEUP: 'PgUp',
  PGDN: 'PgDn',
  PAGEDOWN: 'PgDn',
  INS: 'Ins',
  INSERT: 'Ins'
}

const ARROW_LABELS = {
  UP: '↑',
  DOWN: '↓',
  LEFT: '←',
  RIGHT: '→',
  RGHT: '→'
}

const BASE_KEY_FONT = 7
const MIN_KEY_FONT = 4.5

const normalizeToken = (token) => token.toUpperCase().replace(/_/g, '')

const MAGIC_BINDING = {
  zmk: '&magic',
  qmk: 'MAGIC'
}
const MAGIC_LAYER_NAME = 'Magic'
const DEFAULT_MAGIC_HOLD_LETTERS = ['A', 'X', 'C', 'V', 'B', 'P']
const MAGIC_LETTER_OPTIONS = Array.from({ length: 26 }, (_, index) =>
  String.fromCharCode(65 + index)
)

const LAYER_MODES = [
  { id: 'hold', label: 'Hold', description: 'Active while held' },
  { id: 'toggle', label: 'Toggle', description: 'Press to toggle' },
  { id: 'once', label: 'Once', description: 'Next key only' }
]

const MODIFIER_DEFS = [
  { id: 'lctrl', label: 'L Ctrl', zmk: 'LC', qmk: 'LCTL' },
  { id: 'rctrl', label: 'R Ctrl', zmk: 'RC', qmk: 'RCTL' },
  { id: 'lshift', label: 'L Shift', zmk: 'LS', qmk: 'LSFT' },
  { id: 'rshift', label: 'R Shift', zmk: 'RS', qmk: 'RSFT' },
  { id: 'lalt', label: 'L Alt', zmk: 'LA', qmk: 'LALT' },
  { id: 'ralt', label: 'R Alt', zmk: 'RA', qmk: 'RALT' },
  { id: 'lgui', label: 'L Gui', zmk: 'LG', qmk: 'LGUI' },
  { id: 'rgui', label: 'R Gui', zmk: 'RG', qmk: 'RGUI' }
]

const MODIFIER_DEFS_BY_ID = Object.fromEntries(MODIFIER_DEFS.map((modifier) => [modifier.id, modifier]))
const MODIFIER_LABELS = Object.fromEntries(MODIFIER_DEFS.map((modifier) => [modifier.id, modifier.label]))
const MODIFIER_WRAPPER_MAP = MODIFIER_DEFS.reduce((acc, modifier) => {
  acc[modifier.zmk] = modifier.id
  acc[modifier.qmk] = modifier.id
  return acc
}, {})
const MODIFIER_ORDER = MODIFIER_DEFS.map((modifier) => modifier.id)
const MODIFIER_KEY_MAP = {
  ShiftLeft: 'lshift',
  ShiftRight: 'rshift',
  ControlLeft: 'lctrl',
  ControlRight: 'rctrl',
  AltLeft: 'lalt',
  AltRight: 'ralt',
  MetaLeft: 'lgui',
  MetaRight: 'rgui'
}

const UNICODE_MAX = 0x10ffff
const UNICODE_OS_OPTIONS = [
  { id: 'macos', label: 'macOS', zmk: 'UC_MODE_MACOS', qmk: 'UNICODE_MODE_MACOS' },
  { id: 'linux', label: 'Linux', zmk: 'UC_MODE_LINUX', qmk: 'UNICODE_MODE_LINUX' },
  { id: 'wincompose', label: 'Windows (WinCompose)', zmk: 'UC_MODE_WIN_COMPOSE', qmk: 'UNICODE_MODE_WINCOMPOSE' },
  { id: 'winnumpad', label: 'Windows (HexNumpad)', zmk: 'UC_MODE_WIN_ALT', qmk: 'UNICODE_MODE_WINDOWS' }
]
const DEFAULT_UNICODE_OS = 'linux'

const LAYER_MODE_BINDINGS = {
  hold: { zmk: '&mo', qmk: 'MO' },
  toggle: { zmk: '&tog', qmk: 'TG' },
  once: { zmk: '&sl', qmk: 'OSL' }
}

const getUnicodeOsOption = (value) =>
  UNICODE_OS_OPTIONS.find((option) => option.id === value) ||
  UNICODE_OS_OPTIONS.find((option) => option.id === DEFAULT_UNICODE_OS)

const parseBindingToken = (binding) => {
  if (!binding) return ''
  const trimmed = binding.trim()
  if (!trimmed || trimmed === '&none' || trimmed === 'KC_NO') return ''

  if (trimmed === MAGIC_BINDING.zmk) {
    return MAGIC_BINDING.qmk
  }

  if (trimmed.startsWith('&kp')) {
    const parts = trimmed.split(/\s+/)
    return parts[1] || ''
  }

  const zmkLayerMatch = /^&(mo|tog|sl)\s+(\d+)$/.exec(trimmed)
  if (zmkLayerMatch) return `L${zmkLayerMatch[2]}`

  const qmkLayerMatch = /^(MO|TG|OSL)\((\d+)\)$/.exec(trimmed)
  if (qmkLayerMatch) return `L${qmkLayerMatch[2]}`

  const kcMatch = /KC_([A-Z0-9_]+)/.exec(trimmed)
  if (kcMatch) return kcMatch[1]

  return trimmed
}

const parseUnicodeHexFromBinding = (binding) => {
  if (!binding) return ''
  const trimmed = binding.trim()
  const zmkMatch = /^&uc\s+(?:0x)?([0-9a-fA-F]+)\b/.exec(trimmed)
  if (zmkMatch) return zmkMatch[1].toUpperCase()
  const qmkMatch = /^UC\(\s*0x([0-9a-fA-F]+)\s*\)$/.exec(trimmed)
  if (qmkMatch) return qmkMatch[1].toUpperCase()
  return ''
}

const normalizeUnicodeHexInput = (value) => {
  const trimmed = value.trim().toUpperCase()
  const stripped = trimmed.replace(/^U\+/, '').replace(/^0X/, '')
  if (!stripped) return { hex: '', error: '' }
  if (!/^[0-9A-F]+$/.test(stripped)) {
    return { hex: stripped, error: 'Use hex digits 0-9 and A-F.' }
  }
  const codepoint = Number.parseInt(stripped, 16)
  if (!Number.isFinite(codepoint) || codepoint < 0 || codepoint > UNICODE_MAX) {
    return { hex: stripped, error: 'Code points must be between U+0 and U+10FFFF.' }
  }
  return { hex: stripped, error: '' }
}

const buildUnicodeBindings = (hex) => ({
  zmk: `&uc 0x${hex} 0`,
  qmk: `UC(0x${hex})`
})

const normalizeMagicLetters = (letters) => {
  if (!Array.isArray(letters)) return DEFAULT_MAGIC_HOLD_LETTERS
  const cleaned = letters
    .filter((letter) => typeof letter === 'string')
    .map((letter) => letter.trim().toUpperCase())
    .filter((letter) => /^[A-Z]$/.test(letter))
  const unique = new Set(cleaned)
  return MAGIC_LETTER_OPTIONS.filter((letter) => unique.has(letter))
}

const getOrderedModifiers = (mods) => {
  if (!Array.isArray(mods)) return []
  const unique = new Set(mods)
  return MODIFIER_ORDER.filter((id) => unique.has(id))
}

const formatModifierLabels = (mods) =>
  getOrderedModifiers(mods).map((id) => MODIFIER_LABELS[id]).filter(Boolean)

const parseModifierBinding = (binding) => {
  if (!binding) return { mods: [], base: '' }
  let trimmed = binding.trim()
  if (!trimmed) return { mods: [], base: '' }

  if (trimmed.startsWith('&kp')) {
    const parts = trimmed.split(/\s+/)
    trimmed = parts.slice(1).join(' ')
  }

  const mods = []
  let matched = true
  while (matched) {
    matched = false
    const wrapperMatch = /^([A-Z]+)\((.+)\)$/.exec(trimmed)
    if (wrapperMatch) {
      const wrapper = wrapperMatch[1]
      const inner = wrapperMatch[2]
      const modId = MODIFIER_WRAPPER_MAP[wrapper]
      if (modId) {
        mods.push(modId)
        trimmed = inner
        matched = true
      }
    }
  }

  return { mods, base: trimmed }
}

const applyModifiersToBinding = (binding, target, modifierIds) => {
  if (!binding || !Array.isArray(modifierIds) || modifierIds.length === 0) return binding
  const ordered = getOrderedModifiers(modifierIds)
  if (!ordered.length) return binding
  const trimmed = binding.trim()

  if (target === 'zmk') {
    const kpMatch = /^&kp\s+(.+)$/.exec(trimmed)
    if (!kpMatch) return binding
    let wrapped = kpMatch[1]
    if (!wrapped) return binding
    ordered.forEach((id) => {
      const modifier = MODIFIER_DEFS_BY_ID[id]
      if (modifier?.zmk) {
        wrapped = `${modifier.zmk}(${wrapped})`
      }
    })
    return `&kp ${wrapped}`
  }

  if (!/^KC_[A-Z0-9_]+$/.test(trimmed)) return binding
  if (trimmed === 'KC_TRNS' || trimmed === 'KC_NO') return binding
  let wrapped = trimmed
  ordered.forEach((id) => {
    const modifier = MODIFIER_DEFS_BY_ID[id]
    if (modifier?.qmk) {
      wrapped = `${modifier.qmk}(${wrapped})`
    }
  })
  return wrapped
}

const applyModifiersToItem = (item, modifierIds) => ({
  zmk: applyModifiersToBinding(item.zmk, 'zmk', modifierIds),
  qmk: applyModifiersToBinding(item.qmk, 'qmk', modifierIds)
})

const formatKeyLabel = (binding) => {
  const token = parseBindingToken(binding)
  if (!token) return ''
  if (/^L\d+$/.test(token)) return token

  const upper = token.toUpperCase()
  if (upper.length === 1) return upper
  if (/^N\d$/.test(upper)) return upper.slice(1)
  if (/^\d$/.test(upper)) return upper

  const normalized = normalizeToken(upper)
  if (ARROW_LABELS[normalized]) return ARROW_LABELS[normalized]
  if (KEY_LABELS[normalized]) return KEY_LABELS[normalized]

  return token
}

const findCanonicalLabel = (binding, labelLookup) => {
  const token = parseBindingToken(binding)
  if (!token) return ''
  return labelLookup.get(normalizeToken(token)) || ''
}

const resolveBindingLabel = (binding, layers, labelLookup) => {
  if (!binding) return ''
  const canonical = findCanonicalLabel(binding, labelLookup)
  const label = canonical || formatKeyLabel(binding)
  const layerMatch = /^L(\d+)$/.exec(label)
  if (layerMatch) {
    const index = Number(layerMatch[1])
    return layers?.[index]?.name || label
  }
  return label
}

const resolveKeyLabel = (zmk, qmk, layers, labelLookup) => {
  const unicodeHex = parseUnicodeHexFromBinding(zmk) || parseUnicodeHexFromBinding(qmk)
  if (unicodeHex) return `U+${unicodeHex}`

  const zmkMods = parseModifierBinding(zmk)
  const qmkMods = parseModifierBinding(qmk)
  const modInfo = zmkMods.mods.length ? zmkMods : qmkMods.mods.length ? qmkMods : null
  if (modInfo) {
    const baseLabel =
      resolveBindingLabel(modInfo.base, layers, labelLookup) ||
      resolveBindingLabel(zmk, layers, labelLookup) ||
      resolveBindingLabel(qmk, layers, labelLookup)
    if (baseLabel) {
      const modLabels = formatModifierLabels(modInfo.mods)
      if (modLabels.length) {
        return `${modLabels.join('+')}+${baseLabel}`
      }
    }
  }

  return (
    resolveBindingLabel(zmk, layers, labelLookup) ||
    resolveBindingLabel(qmk, layers, labelLookup)
  )
}

const computeKeyFontSize = (label, unit) => {
  const scale = unit / DEFAULT_U
  const base = BASE_KEY_FONT * scale
  if (!label) return base

  const maxWidth = unit - 4
  const approxCharWidth = 0.6
  const needed = maxWidth / Math.max(label.length, 1) / approxCharWidth
  const min = MIN_KEY_FONT * scale
  return Math.max(Math.min(base, needed), min)
}

const flattenKeyGroups = (groups) =>
  groups.flatMap((group) => group.sections.flatMap((section) => section.items))

const buildLabelLookup = (items) => {
  const lookup = new Map()
  items.forEach((item) => {
    const tokens = new Set()
    const addToken = (value) => {
      const token = parseBindingToken(value)
      if (token) tokens.add(normalizeToken(token))
    }
    addToken(item.zmk)
    addToken(item.qmk)
    if (Array.isArray(item.aliases)) {
      item.aliases.forEach(addToken)
    }
    tokens.forEach((token) => lookup.set(token, item.label))
  })
  return lookup
}

const buildBindingLookup = (items) => {
  const lookup = new Map()
  items.forEach((item) => {
    const tokens = new Set()
    const addToken = (value) => {
      const token = parseBindingToken(value)
      if (token) tokens.add(normalizeToken(token))
    }
    addToken(item.zmk)
    addToken(item.qmk)
    if (Array.isArray(item.aliases)) {
      item.aliases.forEach(addToken)
    }
    tokens.forEach((token) => lookup.set(token, item))
  })
  return lookup
}

const isEditableElement = (target) => {
  if (!target) return false
  if (target.closest?.('.capture-controls')) return false
  if (target.closest?.('.panel-actions')) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

const CODE_TOKEN_MAP = {
  Space: 'SPACE',
  Enter: 'ENTER',
  NumpadEnter: 'ENTER',
  Escape: 'ESC',
  Tab: 'TAB',
  Backspace: 'BSPC',
  Delete: 'DEL',
  Insert: 'INS',
  Home: 'HOME',
  End: 'END',
  PageUp: 'PGUP',
  PageDown: 'PGDN',
  ArrowUp: 'UP',
  ArrowDown: 'DOWN',
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
  Minus: 'MINUS',
  Equal: 'EQUAL',
  BracketLeft: 'LBKT',
  BracketRight: 'RBKT',
  Backslash: 'BSLH',
  Semicolon: 'SCLN',
  Quote: 'QUOT',
  Comma: 'COMM',
  Period: 'DOT',
  Slash: 'SLSH',
  Backquote: 'GRAVE',
  ShiftLeft: 'LSHFT',
  ShiftRight: 'RSHFT',
  ControlLeft: 'LCTRL',
  ControlRight: 'RCTRL',
  AltLeft: 'LALT',
  AltRight: 'RALT',
  MetaLeft: 'LGUI',
  MetaRight: 'RGUI'
}

const getCaptureToken = (event) => {
  if (!event) return ''
  const code = event.code || ''
  if (CODE_TOKEN_MAP[code]) return CODE_TOKEN_MAP[code]
  if (code.startsWith('Key')) return code.slice(3).toUpperCase()
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Numpad')) {
    const value = code.slice(6)
    if (/^\d$/.test(value)) return value
  }
  if (/^F\d{1,2}$/.test(code)) return code
  if (event.key && event.key.length === 1) return event.key.toUpperCase()
  return ''
}

const expandDots = (input) => {
  if (Array.isArray(input)) {
    return input.map(expandDots)
  }
  if (!input || typeof input !== 'object') {
    return input
  }
  const output = {}
  const mergeValue = (target, value) => {
    if (!target) {
      return value
    }
    if (typeof target === 'object' && typeof value === 'object') {
      return { ...target, ...value }
    }
    return value
  }
  Object.entries(input).forEach(([key, value]) => {
    const expanded = expandDots(value)
    if (key.includes('.')) {
      const parts = key.split('.')
      let cursor = output
      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          cursor[part] = mergeValue(cursor[part], expanded)
        } else {
          if (!cursor[part] || typeof cursor[part] !== 'object') {
            cursor[part] = {}
          }
          cursor = cursor[part]
        }
      })
    } else {
      output[key] = mergeValue(output[key], expanded)
    }
  })
  return output
}

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const rotatePoint = (x, y, degrees) => {
  const radians = (degrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos
  }
}

const parseDistance = (distance, unit) => {
  if (typeof distance === 'number') return distance
  if (typeof distance !== 'string') return 0
  const trimmed = distance.trim()
  if (trimmed.endsWith('u')) {
    const value = Number(trimmed.slice(0, -1))
    return (Number.isFinite(value) ? value : 0) * unit
  }
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : 0
}

const parseErgogen = (yamlText) => {
  const warnings = []
  if (!yamlText.trim()) {
    return { keys: [], matrix: null, warnings, bounds: null }
  }
  const raw = yaml.load(yamlText)
  const doc = expandDots(raw)
  const units = doc?.units || {}
  const unit = toNumber(units.u, DEFAULT_U)
  const points = doc?.points || {}
  const zones = points?.zones || {}
  const globalRotate = toNumber(points.rotate, 0)

  const keys = []
  const keyById = {}
  const rowList = []
  const colList = []
  const rowIndexByName = {}
  const colIndexByName = {}

  const pinMap = {}
  const mcu = doc?.pcbs?.main?.footprints?.mcu?.params || {}
  Object.entries(mcu).forEach(([pin, net]) => {
    if (typeof net === 'string' && pin.startsWith('P')) {
      pinMap[net] = pin
    }
  })

  const trrsParams = doc?.pcbs?.main?.footprints?.trrs?.params || {}
  const trrsSignalPin = Object.entries(trrsParams)
    .filter(([key]) => /^[A-D]$/.test(key))
    .map(([, net]) => (typeof net === 'string' ? net : null))
    .find((net) => net && /^P\d+$/.test(net))

  const zoneEntries = Object.entries(zones)
  zoneEntries.forEach(([zoneName, zone], zoneIndex) => {
    const anchor = zone?.anchor || {}
    const anchorShift = anchor.shift || [0, 0]
    const anchorShiftX = parseDistance(anchorShift?.[0] ?? 0, unit)
    const anchorShiftY = parseDistance(anchorShift?.[1] ?? 0, unit)
    const anchorRotate = toNumber(anchor.rotate, 0)
    let refKey = null
    if (anchor.ref) {
      refKey = keyById[anchor.ref]
      if (!refKey) {
        warnings.push(`Anchor ref ${anchor.ref} not found for zone ${zoneName}`)
      }
    }
    const baseRotate = refKey ? refKey.rot : globalRotate
    const zoneRotate = baseRotate + anchorRotate + toNumber(zone.rotate, 0)
    const anchorShiftRotated = rotatePoint(anchorShiftX, anchorShiftY, baseRotate + anchorRotate)
    let anchorX = (refKey ? refKey.x : 0) + anchorShiftRotated.x
    let anchorY = (refKey ? refKey.y : 0) + anchorShiftRotated.y

    const rows = zone?.rows || {}
    const rowNames = Object.keys(rows)
    rowNames.forEach((rowName) => {
      if (rowIndexByName[rowName] === undefined) {
        rowIndexByName[rowName] = rowList.length
        rowList.push({ name: rowName, net: rows[rowName]?.row_net || '' })
      }
    })

    const columns = zone?.columns || {}
    const colEntries = Object.entries(columns)
    let columnX = 0
    let columnY = 0
    let columnRotation = zoneRotate
    colEntries.forEach(([colName, column]) => {
      if (colIndexByName[colName] === undefined) {
        colIndexByName[colName] = colList.length
        colList.push({ name: colName, net: column?.key?.column_net || '' })
      }
      const columnKey = column?.key || {}
      const spread = toNumber(columnKey.spread ?? zone?.key?.spread ?? unit, unit)
      const stagger = toNumber(columnKey.stagger ?? zone?.key?.stagger ?? 0, 0)
      const splay = toNumber(columnKey.splay ?? zone?.key?.splay ?? 0, 0)
      const originValue = columnKey.origin ?? zone?.key?.origin ?? [0, 0]
      const originX = parseDistance(originValue?.[0] ?? 0, unit)
      const originY = parseDistance(originValue?.[1] ?? 0, unit)
      const colRows = column?.rows || {}

      columnY += stagger

      if (splay !== 0) {
        const pivotX = columnX + originX
        const pivotY = columnY + originY
        const rotatedAnchor = rotatePoint(columnX - pivotX, columnY - pivotY, splay)
        columnX = pivotX + rotatedAnchor.x
        columnY = pivotY + rotatedAnchor.y
      }
      columnRotation += splay

      rowNames.forEach((rowName, rowIndex) => {
        const rowInfo = rows[rowName] || {}
        const rowEntry = colRows[rowName] || {}
        const isSkipped = rowEntry?.skip === true || rowEntry?.key?.skip === true
        const localX = columnX
        const localY = columnY + rowIndex * unit
        const rotated = rotatePoint(localX, localY, columnRotation)
        const keyX = rotated.x + anchorX
        const keyY = rotated.y + anchorY
        const keyId = `${zoneName}_${colName}_${rowName}`
        const key = {
          id: keyId,
          zone: zoneName,
          row: rowName,
          col: colName,
          row_net: rowInfo.row_net || '',
          col_net: columnKey.column_net || '',
          x: keyX,
          y: keyY,
          rot: columnRotation,
          unit,
          rowIndex: rowIndexByName[rowName],
          colIndex: colIndexByName[colName],
          zoneOrder: zoneIndex,
          skip: isSkipped
        }
        keys.push(key)
        keyById[keyId] = key
      })
      columnX += spread
    })
  })

  const mirror = points?.mirror
  if (mirror) {
    const distance = parseDistance(mirror.distance, unit)
    const refKey = mirror.ref ? keyById[mirror.ref] : null
    const axisX = refKey ? refKey.x + distance / 2 : distance / 2
    const mirroredKeys = keys.map((key) => ({
      ...key,
      id: `mirror_${key.id}`,
      x: axisX + (axisX - key.x),
      rot: -key.rot,
      mirror_of: key.id
    }))
    mirroredKeys.forEach((key) => {
      keys.push(key)
      keyById[key.id] = key
    })
  }

  if (mirror && !trrsSignalPin) {
    warnings.push('TRRS pin not found for split QMK configuration')
  }

  const bounds = keys.reduce(
    (acc, key) => {
      const size = key.unit
      const displayY = -key.y
      acc.minX = Math.min(acc.minX, key.x - size / 2)
      acc.maxX = Math.max(acc.maxX, key.x + size / 2)
      acc.minY = Math.min(acc.minY, displayY - size / 2)
      acc.maxY = Math.max(acc.maxY, displayY + size / 2)
      return acc
    },
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
  )

  rowList.forEach((row) => {
    if (!row.net) {
      warnings.push(`Row ${row.name} is missing row_net`)
    } else if (!pinMap[row.net]) {
      warnings.push(`Row net ${row.net} has no MCU pin mapping`)
    }
  })
  colList.forEach((col) => {
    if (!col.net) {
      warnings.push(`Column ${col.name} is missing column_net`)
    } else if (!pinMap[col.net]) {
      warnings.push(`Column net ${col.net} has no MCU pin mapping`)
    }
  })

  const matrix = {
    rows: rowList,
    cols: colList,
    pinMap,
    mirrored: Boolean(mirror),
    trrsPin: trrsSignalPin || ''
  }

  return { keys, matrix, warnings, bounds }
}

const createLayer = (index) => ({
  id: `layer-${index}`,
  name: index === 0 ? 'Base' : `Layer ${index}`,
  bindings: {}
})

const clampLayerIndex = (index, layers) => {
  const maxIndex = Math.max(layers.length - 1, 0)
  if (!Number.isFinite(index)) return 0
  return Math.min(Math.max(0, index), maxIndex)
}

const findLayerIndexById = (layers, id, fallback = 0) => {
  if (!id) return fallback
  const index = layers.findIndex((layer) => layer.id === id)
  return index === -1 ? fallback : index
}

const ensureLayers = (layers, keys) => {
  if (layers.length === 0) {
    return [createLayer(0)]
  }
  return layers.map((layer) => ({
    ...layer,
    bindings: { ...layer.bindings }
  }))
}

const buildLayerPalette = (layers, mode) =>
  layers.slice(1).map((layer, index) => {
    const layerIndex = index + 1
    const bindingMode = LAYER_MODE_BINDINGS[mode] || LAYER_MODE_BINDINGS.hold
    return {
      label: layer.name,
      zmk: `${bindingMode.zmk} ${layerIndex}`,
      qmk: `${bindingMode.qmk}(${layerIndex})`
    }
  })

const getLayerIndexFromBinding = (value) => {
  if (!value) return null
  const trimmed = value.trim()
  const zmkMatch = /^&(mo|tog|sl)\s+(\d+)$/.exec(trimmed)
  if (zmkMatch) {
    const mode = zmkMatch[1] === 'mo' ? 'hold' : zmkMatch[1] === 'tog' ? 'toggle' : 'once'
    return { index: Number(zmkMatch[2]), type: 'zmk', mode }
  }
  const qmkMatch = /^(MO|TG|OSL)\((\d+)\)$/.exec(trimmed)
  if (qmkMatch) {
    const mode = qmkMatch[1] === 'MO' ? 'hold' : qmkMatch[1] === 'TG' ? 'toggle' : 'once'
    return { index: Number(qmkMatch[2]), type: 'qmk', mode }
  }
  return null
}

const formatLayerBinding = (index, type, mode) => {
  const bindingMode = LAYER_MODE_BINDINGS[mode] || LAYER_MODE_BINDINGS.hold
  if (type === 'zmk') {
    return `${bindingMode.zmk} ${index}`
  }
  return `${bindingMode.qmk}(${index})`
}

const updateLayerBinding = (value, removedIndex) => {
  if (!value) return value
  const parsed = getLayerIndexFromBinding(value)
  if (!parsed) return value
  const { index, type, mode } = parsed
  if (index === removedIndex) return ''
  if (index > removedIndex) {
    const nextIndex = index - 1
    return formatLayerBinding(nextIndex, type, mode)
  }
  return value
}

const shiftLayerBindings = (layers, removedIndex) =>
  layers.map((layerItem) => ({
    ...layerItem,
    bindings: Object.fromEntries(
      Object.entries(layerItem.bindings).map(([keyId, binding]) => [
        keyId,
        {
          zmk: updateLayerBinding(binding?.zmk || '', removedIndex),
          qmk: updateLayerBinding(binding?.qmk || '', removedIndex)
        }
      ])
    )
  }))

const remapLayerBinding = (value, indexMap) => {
  if (!value) return value
  const parsed = getLayerIndexFromBinding(value)
  if (!parsed) return value
  const { index, type, mode } = parsed
  if (indexMap[index] === undefined) return value
  const nextIndex = indexMap[index]
  return formatLayerBinding(nextIndex, type, mode)
}

const remapLayerBindings = (layers, indexMap) =>
  layers.map((layerItem) => ({
    ...layerItem,
    bindings: Object.fromEntries(
      Object.entries(layerItem.bindings).map(([keyId, binding]) => [
        keyId,
        {
          zmk: remapLayerBinding(binding?.zmk || '', indexMap),
          qmk: remapLayerBinding(binding?.qmk || '', indexMap)
        }
      ])
    )
  }))

const moveArrayItem = (items, fromIndex, toIndex) => {
  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

const reorderLayers = (layers, fromIndex, toIndex) => {
  const order = layers.map((_, index) => index)
  const nextOrder = moveArrayItem(order, fromIndex, toIndex)
  const nextLayers = moveArrayItem(layers, fromIndex, toIndex)
  const indexMap = Object.fromEntries(nextOrder.map((oldIndex, newIndex) => [oldIndex, newIndex]))
  return { nextLayers, indexMap }
}

const isMagicBinding = (binding) => {
  if (!binding) return false
  const trimmed = binding.trim()
  return trimmed === MAGIC_BINDING.zmk || trimmed === MAGIC_BINDING.qmk
}

const hasMagicBinding = (layers) =>
  layers.some((layer) =>
    Object.values(layer.bindings).some(
      (binding) => isMagicBinding(binding?.zmk) || isMagicBinding(binding?.qmk)
    )
  )

const hasUnicodeBinding = (layers, target) =>
  layers.some((layer) =>
    Object.values(layer.bindings).some((binding) =>
      parseUnicodeHexFromBinding(binding?.[target])
    )
  )

const getAlphaToken = (binding) => {
  const modifierInfo = parseModifierBinding(binding)
  const baseBinding = modifierInfo.base || binding
  const token = parseBindingToken(baseBinding)
  if (!token) return ''
  const upper = token.toUpperCase()
  if (upper.length === 1 && upper >= 'A' && upper <= 'Z') return upper
  return ''
}

const resolveMagicBinding = (binding, magicLayerIndex, target, unicodeOs) => {
  if (!isMagicBinding(binding)) return binding
  if (unicodeOs === 'macos') {
    return target === 'zmk' ? '&kp LGUI' : 'KC_LGUI'
  }
  return target === 'zmk'
    ? `&lt ${magicLayerIndex} LGUI`
    : `LT(${magicLayerIndex}, KC_LGUI)`
}

const buildMagicLayerBindings = (keys, baseLayer, target, magicHoldLetters) =>
  keys.map((key) => {
    const binding = baseLayer?.bindings[key.id]
    const baseValue = binding?.zmk || binding?.qmk || ''
    const alpha = getAlphaToken(baseValue)
    if (magicHoldLetters.has(alpha)) {
      return target === 'zmk' ? `&kp LC(${alpha})` : `LCTL(KC_${alpha})`
    }
    return target === 'zmk' ? '&trans' : 'KC_TRNS'
  })

const formatZmkKeymap = (keys, layers, magicHoldLetters, defaultLayer, unicodeOs) => {
  const hasMagic = hasMagicBinding(layers)
  const useUnicode = hasUnicodeBinding(layers, 'zmk')
  const unicodeConfig = getUnicodeOsOption(unicodeOs)
  const magicLayerIndex = layers.length
  const enableMagicLayer = hasMagic && unicodeOs !== 'macos'
  const layerBlocks = layers.map((layer, index) => {
    const bindings = keys
      .map((key) => {
        const value = layer.bindings[key.id]?.zmk || '&none'
        const updated = hasMagic
          ? resolveMagicBinding(value, magicLayerIndex, 'zmk', unicodeOs)
          : value
        return updated || '&none'
      })
      .join(' ')
    return `    layer_${index} {\n      label = "${layer.name}";\n      bindings = < ${bindings} >;\n    };`
  })
  if (enableMagicLayer) {
    const magicBindings = buildMagicLayerBindings(
      keys,
      layers[0],
      'zmk',
      magicHoldLetters
    ).join(' ')
    layerBlocks.push(
      `    layer_${magicLayerIndex} {\n      label = "${MAGIC_LAYER_NAME}";\n      bindings = < ${magicBindings} >;\n    };`
    )
  }
  const safeDefault = clampLayerIndex(defaultLayer, layers)
  const unicodeHeader = useUnicode
    ? `#include <behaviors/unicode.dtsi>\n\n&uc {\n  default-mode = <${unicodeConfig.zmk}>;\n};\n\n`
    : ''
  return `${unicodeHeader}/ {\n  keymap {\n    compatible = "zmk,keymap";\n    default_layer = <${safeDefault}>;\n    layers {\n${layerBlocks.join('\n')}\n    };\n  };\n};\n`
}

const pinToGpio = (pin) => {
  if (!pin) return null
  const match = /^P(\d+)$/.exec(pin)
  if (match) {
    return `&gpio0 ${match[1]} GPIO_ACTIVE_HIGH`
  }
  return pin
}

const formatZmkOverlay = (matrix) => {
  const rowPins = matrix.rows.map((row) => pinToGpio(matrix.pinMap[row.net])).filter(Boolean)
  const colPins = matrix.cols.map((col) => pinToGpio(matrix.pinMap[col.net])).filter(Boolean)
  return `/ {\n  kscan0: kscan_0 {\n    compatible = "zmk,kscan-gpio-matrix";\n    row-gpios = < ${rowPins.join(' ')} >;\n    col-gpios = < ${colPins.join(' ')} >;\n    diode-direction = "col2row";\n  };\n};\n`
}

const formatQmkConfigH = (matrix) => {
  const lines = ['#pragma once', '', '#define MASTER_LEFT']
  if (matrix?.trrsPin) {
    lines.push(`#define SOFT_SERIAL_PIN ${matrix.trrsPin}`)
  }
  return `${lines.join('\n')}\n`
}

const formatQmkRulesMk = () =>
  `SPLIT_KEYBOARD = yes\nSPLIT_TRANSPORT = serial\nSERIAL_DRIVER = software\n`

const formatQmkInfo = (keys, matrix) => {
  const unit = keys[0]?.unit || DEFAULT_U
  const layout = keys.map((key) => ({
    label: key.id,
    x: Number((key.x / unit).toFixed(2)),
    y: Number((key.y / unit).toFixed(2))
  }))
  return JSON.stringify(
    {
      keyboard_name: 'custom-ergogen',
      manufacturer: 'custom',
      maintainer: 'you',
      matrix_pins: {
        rows: matrix.rows.map((row) => matrix.pinMap[row.net] || ''),
        cols: matrix.cols.map((col) => matrix.pinMap[col.net] || '')
      },
      diode_direction: 'COL2ROW',
      split: matrix.mirrored,
      layouts: {
        LAYOUT: {
          layout
        }
      }
    },
    null,
    2
  )
}

const formatQmkKeymap = (keys, layers, magicHoldLetters, defaultLayer, unicodeOs) => {
  const hasMagic = hasMagicBinding(layers)
  const useUnicode = hasUnicodeBinding(layers, 'qmk')
  const unicodeConfig = getUnicodeOsOption(unicodeOs)
  const magicLayerIndex = layers.length
  const enableMagicLayer = hasMagic && unicodeOs !== 'macos'
  const safeDefault = clampLayerIndex(defaultLayer, layers)
  const layerBlocks = layers
    .map((layer, layerIndex) => {
      const keycodes = keys.map((key) => {
        const value = layer.bindings[key.id]?.qmk || 'KC_NO'
        const updated = hasMagic
          ? resolveMagicBinding(value, magicLayerIndex, 'qmk', unicodeOs)
          : value
        return updated || 'KC_NO'
      })
      return `  [${layerIndex}] = LAYOUT(\n    ${keycodes.join(',\n    ')}\n  )`
    })
    .concat(
      enableMagicLayer
        ? [
            `  [${magicLayerIndex}] = LAYOUT(\n    ${buildMagicLayerBindings(
              keys,
              layers[0],
              'qmk',
              magicHoldLetters
            ).join(',\n    ')}\n  )`
          ]
        : []
    )
    .join(',\n')

  const unicodeInit = useUnicode
    ? `  set_unicode_input_mode(${unicodeConfig.qmk});\n`
    : ''
  return `#include QMK_KEYBOARD_H\n\nconst uint16_t PROGMEM keymaps[][MATRIX_ROWS][MATRIX_COLS] = {\n${layerBlocks}\n};\n\nvoid keyboard_post_init_user(void) {\n${unicodeInit}  default_layer_set(1UL << ${safeDefault});\n}\n`
}

const DEFAULT_SAVE_NAME = 'keyboard-config.kb.json'

const PALETTE_TABS = [
  { id: 'core', label: 'Core keys' },
  { id: 'function', label: 'Function & media/system keys' },
  { id: 'other', label: 'Other' }
]

const downloadFile = (filename, content, type = 'text/plain') => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

const saveFileWithPicker = async (filename, content, type = 'text/plain') => {
  if (typeof window === 'undefined' || !window.showSaveFilePicker) {
    downloadFile(filename, content, type)
    return filename
  }

  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: filename,
      types: [
        {
          accept: { 'application/json': ['.json'] }
        }
      ]
    })
    const writable = await handle.createWritable()
    await writable.write(new Blob([content], { type }))
    await writable.close()
    return handle?.name || filename
  } catch (error) {
    if (error?.name === 'AbortError') return null
    downloadFile(filename, content, type)
    return filename
  }
}

function App() {
  const [parseError, setParseError] = useState('')
  const [parsed, setParsed] = useState({ keys: [], matrix: null, warnings: [], bounds: null })
  const [layers, setLayers] = useState([createLayer(0)])
  const [activeLayer, setActiveLayer] = useState(0)
  const [defaultLayerZmk, setDefaultLayerZmk] = useState(0)
  const [defaultLayerQmk, setDefaultLayerQmk] = useState(0)
  const [unicodeOsZmk, setUnicodeOsZmk] = useState(DEFAULT_UNICODE_OS)
  const [unicodeOsQmk, setUnicodeOsQmk] = useState(DEFAULT_UNICODE_OS)
  const [selectedKeyId, setSelectedKeyId] = useState(null)
  const [showGhosts, setShowGhosts] = useState(false)
  const [lastLoaded, setLastLoaded] = useState('')
  const [dragLayerIndex, setDragLayerIndex] = useState(null)
  const [dragOverLayerIndex, setDragOverLayerIndex] = useState(null)
  const [exportTarget, setExportTarget] = useState('zmk')
  const [layerMode, setLayerMode] = useState('hold')
  const [magicHoldLetters, setMagicHoldLetters] = useState(DEFAULT_MAGIC_HOLD_LETTERS)
  const [captureMode, setCaptureMode] = useState(false)
  const [captureIndex, setCaptureIndex] = useState(0)
  const [captureRowDirection, setCaptureRowDirection] = useState('asc')
  const [captureColDirection, setCaptureColDirection] = useState('asc')
  const [modifierSelection, setModifierSelection] = useState([])
  const [unicodeHexInput, setUnicodeHexInput] = useState('')
  const [unicodeHexError, setUnicodeHexError] = useState('')
  const [paletteTab, setPaletteTab] = useState('core')
  const activeLayerInputRef = useRef(null)
  const captureModifiersRef = useRef(new Set())

  const magicHoldSet = useMemo(() => new Set(magicHoldLetters), [magicHoldLetters])
  const modifierSelectionSet = useMemo(() => new Set(modifierSelection), [modifierSelection])

  const visibleKeys = useMemo(() => parsed.keys.filter((key) => !key.skip), [parsed.keys])
  const captureKeys = useMemo(() => {
    const rowDirection = captureRowDirection === 'desc' ? -1 : 1
    const colDirection = captureColDirection === 'desc' ? -1 : 1
    const isMirrored = Boolean(parsed.matrix?.mirrored)

    if (isMirrored) {
      const byRow = new Map()
      const rowIndexes = new Set()
      visibleKeys.forEach((key) => {
        const list = byRow.get(key.rowIndex) || []
        list.push(key)
        byRow.set(key.rowIndex, list)
        rowIndexes.add(key.rowIndex)
      })

      const orderedRows = Array.from(rowIndexes).sort((a, b) => (a - b) * rowDirection)
      const next = []
      orderedRows.forEach((rowIndex) => {
        const rowKeys = byRow.get(rowIndex) || []
        const mainKeys = rowKeys.filter((key) => !key.mirror_of)
        const mirrorKeys = rowKeys.filter((key) => key.mirror_of)
        mainKeys.sort((a, b) => {
          if (a.colIndex !== b.colIndex) return (a.colIndex - b.colIndex) * colDirection
          if (a.zoneOrder !== b.zoneOrder) return a.zoneOrder - b.zoneOrder
          return a.id.localeCompare(b.id)
        })
        mirrorKeys.sort((a, b) => {
          if (a.colIndex !== b.colIndex) return (b.colIndex - a.colIndex) * colDirection
          if (a.zoneOrder !== b.zoneOrder) return a.zoneOrder - b.zoneOrder
          return a.id.localeCompare(b.id)
        })
        next.push(...mainKeys, ...mirrorKeys)
      })
      return next
    }

    const next = [...visibleKeys]
    const primary = 'col'
    const secondary = 'row'
    next.sort((a, b) => {
      const primaryDiff =
        primary === 'row'
          ? (a.rowIndex - b.rowIndex) * rowDirection
          : (a.colIndex - b.colIndex) * colDirection
      if (primaryDiff !== 0) return primaryDiff
      const secondaryDiff =
        secondary === 'row'
          ? (a.rowIndex - b.rowIndex) * rowDirection
          : (a.colIndex - b.colIndex) * colDirection
      if (secondaryDiff !== 0) return secondaryDiff
      if (a.zoneOrder !== b.zoneOrder) return a.zoneOrder - b.zoneOrder
      return a.id.localeCompare(b.id)
    })
    return next
  }, [
    visibleKeys,
    parsed.matrix?.mirrored,
    captureRowDirection,
    captureColDirection
  ])
  const captureIndexById = useMemo(
    () => new Map(captureKeys.map((key, index) => [key.id, index])),
    [captureKeys]
  )
  const selectedKey = useMemo(
    () => visibleKeys.find((key) => key.id === selectedKeyId) || null,
    [visibleKeys, selectedKeyId]
  )

  const layer = layers[activeLayer]
  const binding = selectedKey ? layer?.bindings[selectedKey.id] : null
  const selectedUnicodeHex = useMemo(
    () => parseUnicodeHexFromBinding(binding?.zmk) || parseUnicodeHexFromBinding(binding?.qmk),
    [binding]
  )
  const registryItems = useMemo(() => flattenKeyGroups(KEY_GROUPS), [])
  const labelLookup = useMemo(() => buildLabelLookup(registryItems), [registryItems])
  const bindingLookup = useMemo(() => buildBindingLookup(registryItems), [registryItems])
  const paletteGroups = useMemo(() => {
    const groups = KEY_GROUPS.map((group) => ({
      title: group.title,
      sections: group.sections
    }))
    const layerItems = buildLayerPalette(layers, layerMode)
    if (layerItems.length) {
      groups.push({
        title: 'Layers',
        sections: [{ title: 'Layers', items: layerItems }]
      })
    }
    return groups
  }, [layers, layerMode])

  const paletteTabs = useMemo(() => {
    const grouped = {
      core: [],
      function: [],
      other: []
    }
    paletteGroups.forEach((group) => {
      if (group.title === 'Core') {
        grouped.core.push(group)
      } else if (group.title === 'Function Row' || group.title === 'Media/System') {
        grouped.function.push(group)
      } else {
        grouped.other.push(group)
      }
    })
    return grouped
  }, [paletteGroups])

  const viewBox = useMemo(() => {
    if (!parsed.bounds) return '0 0 400 400'
    const padding = 24
    const width = parsed.bounds.maxX - parsed.bounds.minX + padding * 2
    const height = parsed.bounds.maxY - parsed.bounds.minY + padding * 2
    const x = parsed.bounds.minX - padding
    const y = parsed.bounds.minY - padding
    return `${x} ${y} ${width} ${height}`
  }, [parsed.bounds])

  const parseYamlText = (text) => {
    try {
      const result = parseErgogen(text)
      setParsed(result)
      setParseError('')
      const nextLayers = ensureLayers(layers, result.keys)
      setLayers(nextLayers)
      const firstVisibleKey = result.keys.find((key) => !key.skip)
      if (firstVisibleKey && !selectedKeyId) {
        setSelectedKeyId(firstVisibleKey.id)
      }
    } catch (error) {
      setParseError(error.message || 'Failed to parse YAML')
    }
  }

  const renderKeys = showGhosts ? parsed.keys : visibleKeys
  const activePaletteGroups = paletteTabs[paletteTab] || []

  useEffect(() => {
    if (!selectedKeyId) return
    const nextIndex = captureIndexById.get(selectedKeyId)
    if (nextIndex === undefined) return
    setCaptureIndex(nextIndex)
  }, [captureIndexById, selectedKeyId])

  useEffect(() => {
    setUnicodeHexInput(selectedUnicodeHex || '')
    setUnicodeHexError('')
  }, [selectedUnicodeHex, selectedKeyId, activeLayer])

  useEffect(() => {
    if (paletteTab === 'other' || paletteTabs[paletteTab]?.length) return
    const nextTab = PALETTE_TABS.find((tab) => paletteTabs[tab.id]?.length)?.id || 'core'
    if (nextTab !== paletteTab) {
      setPaletteTab(nextTab)
    }
  }, [paletteTab, paletteTabs])

  useLayoutEffect(() => {
    const input = activeLayerInputRef.current
    if (!input) return undefined
    const measure = () => {
      input.style.width = '0px'
      const nextWidth = Math.max(input.scrollWidth + 2, 24)
      input.style.width = `${nextWidth}px`
    }
    measure()
    const rafId = window.requestAnimationFrame(measure)
    let cancelled = false
    if (document?.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (!cancelled) measure()
      })
    }
    return () => {
      cancelled = true
      window.cancelAnimationFrame(rafId)
    }
  }, [layer?.name, activeLayer, parsed.keys.length])

  const updateBinding = (field, value) => {
    if (!selectedKey) return
    setLayers((prev) =>
      prev.map((layerItem, index) => {
        if (index !== activeLayer) return layerItem
        return {
          ...layerItem,
          bindings: {
            ...layerItem.bindings,
            [selectedKey.id]: {
              zmk: field === 'zmk' ? value : layerItem.bindings[selectedKey.id]?.zmk || '',
              qmk: field === 'qmk' ? value : layerItem.bindings[selectedKey.id]?.qmk || ''
            }
          }
        }
      })
    )
  }

  const updateKeyBinding = (keyId, value) => {
    if (!keyId) return
    setLayers((prev) =>
      prev.map((layerItem, index) => {
        if (index !== activeLayer) return layerItem
        return {
          ...layerItem,
          bindings: {
            ...layerItem.bindings,
            [keyId]: {
              zmk: value?.zmk || '',
              qmk: value?.qmk || ''
            }
          }
        }
      })
    )
  }

  const applyUnicodeBinding = () => {
    if (!selectedKey) return
    const normalized = normalizeUnicodeHexInput(unicodeHexInput)
    if (!normalized.hex || normalized.error) {
      setUnicodeHexError(normalized.error || 'Enter a Unicode code point.')
      return
    }
    setUnicodeHexError('')
    updateKeyBinding(selectedKey.id, buildUnicodeBindings(normalized.hex))
  }

  const clearUnicodeBinding = () => {
    if (!selectedKey) return
    updateKeyBinding(selectedKey.id, { zmk: '&none', qmk: 'KC_NO' })
  }

  const toggleMagicLetter = (letter) => {
    setMagicHoldLetters((prev) => {
      const next = new Set(prev)
      if (next.has(letter)) {
        next.delete(letter)
      } else {
        next.add(letter)
      }
      return MAGIC_LETTER_OPTIONS.filter((entry) => next.has(entry))
    })
  }

  const toggleModifierSelection = (modifierId) => {
    setModifierSelection((prev) =>
      prev.includes(modifierId) ? prev.filter((id) => id !== modifierId) : [...prev, modifierId]
    )
  }

  const clearModifierSelection = () => {
    setModifierSelection([])
  }

  const applyPalette = (item) => {
    if (!selectedKey) return
    const modified = applyModifiersToItem(item, modifierSelection)
    setLayers((prev) =>
      prev.map((layerItem, index) => {
        if (index !== activeLayer) return layerItem
        return {
          ...layerItem,
          bindings: {
            ...layerItem.bindings,
            [selectedKey.id]: { zmk: modified.zmk, qmk: modified.qmk }
          }
        }
      })
    )
  }

  const startCapture = () => {
    if (captureKeys.length === 0) return
    const startIndex = Math.max(0, captureIndexById.get(selectedKeyId) ?? 0)
    setCaptureIndex(startIndex)
    setSelectedKeyId(captureKeys[startIndex]?.id || null)
    setCaptureMode(true)
  }

  const stopCapture = () => {
    setCaptureMode(false)
  }

  const addLayer = () => {
    setLayers((prev) => {
      const nextIndex = prev.length
      setActiveLayer(nextIndex)
      return [...prev, createLayer(nextIndex)]
    })
  }

  const duplicateLayer = () => {
    setLayers((prev) => {
      const source = prev[activeLayer]
      const nextIndex = prev.length
      const copy = {
        id: `layer-${nextIndex}`,
        name: `${source.name} Copy`,
        bindings: { ...source.bindings }
      }
      setActiveLayer(nextIndex)
      return [...prev, copy]
    })
  }

  const renameLayer = (value) => {
    setLayers((prev) =>
      prev.map((layerItem, index) => (index === activeLayer ? { ...layerItem, name: value } : layerItem))
    )
  }

  const removeLayer = () => {
    if (layers.length <= 1) return
    setLayers((prev) => {
      const zmkId = prev[defaultLayerZmk]?.id
      const qmkId = prev[defaultLayerQmk]?.id
      const next = prev.filter((_, index) => index !== activeLayer)
      setDefaultLayerZmk(findLayerIndexById(next, zmkId, 0))
      setDefaultLayerQmk(findLayerIndexById(next, qmkId, 0))
      return shiftLayerBindings(next, activeLayer)
    })
    setActiveLayer(0)
  }

  const handleLayerDragStart = (index) => (event) => {
    if (index === 0) return
    setDragLayerIndex(index)
    setDragOverLayerIndex(index)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }

  const handleLayerDragOver = (index) => (event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  const handleLayerDragEnter = (index) => (event) => {
    event.preventDefault()
    setDragOverLayerIndex(index)
    const fromIndex = dragLayerIndex
    if (fromIndex === null) return
    const targetIndex = index === 0 ? 1 : index
    if (fromIndex === targetIndex) return
    setLayers((prev) => {
      if (fromIndex < 0 || fromIndex >= prev.length || targetIndex >= prev.length) return prev
      const zmkId = prev[defaultLayerZmk]?.id
      const qmkId = prev[defaultLayerQmk]?.id
      const { nextLayers, indexMap } = reorderLayers(prev, fromIndex, targetIndex)
      setActiveLayer((current) => indexMap[current] ?? current)
      setDefaultLayerZmk(findLayerIndexById(nextLayers, zmkId, 0))
      setDefaultLayerQmk(findLayerIndexById(nextLayers, qmkId, 0))
      return remapLayerBindings(nextLayers, indexMap)
    })
    setDragLayerIndex(targetIndex)
  }

  const handleLayerDrop = (index) => (event) => {
    event.preventDefault()
    setDragLayerIndex(null)
    setDragOverLayerIndex(null)
  }

  const handleLayerDragEnd = () => {
    setDragLayerIndex(null)
    setDragOverLayerIndex(null)
  }

  const handleFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    parseYamlText(text)
    setLastLoaded(file.name)
  }

  const handleSave = async () => {
    if (!parsed.matrix) return
    const saveName = lastLoaded || DEFAULT_SAVE_NAME
    const payload = {
      version: 1,
      yaml: null,
      parsed: {
        keys: parsed.keys,
        matrix: parsed.matrix,
        warnings: parsed.warnings,
        bounds: parsed.bounds
      },
      layers,
      activeLayer,
      selectedKeyId,
      defaultLayers: {
        zmk: defaultLayerZmk,
        qmk: defaultLayerQmk
      },
      unicode: {
        os: {
          zmk: unicodeOsZmk,
          qmk: unicodeOsQmk
        }
      },
      magic: {
        holdLetters: magicHoldLetters
      }
    }
    const savedName = await saveFileWithPicker(
      saveName,
      JSON.stringify(payload, null, 2),
      'application/json'
    )
    if (savedName) {
      setLastLoaded(savedName)
    }
  }

  const handleLoadSave = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const data = JSON.parse(text)
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid save file')
      }
      if (data.version !== 1) {
        throw new Error('Unsupported save file version')
      }
      if (data.parsed?.keys && data.parsed?.matrix) {
        setParsed({
          keys: data.parsed.keys,
          matrix: data.parsed.matrix,
          warnings: data.parsed.warnings || [],
          bounds: data.parsed.bounds || null
        })
      }
      if (Array.isArray(data.layers) && data.layers.length > 0) {
        setLayers(data.layers)
        setDefaultLayerZmk(clampLayerIndex(data.defaultLayers?.zmk ?? 0, data.layers))
        setDefaultLayerQmk(clampLayerIndex(data.defaultLayers?.qmk ?? 0, data.layers))
      }
      setUnicodeOsZmk(getUnicodeOsOption(data.unicode?.os?.zmk)?.id || DEFAULT_UNICODE_OS)
      setUnicodeOsQmk(getUnicodeOsOption(data.unicode?.os?.qmk)?.id || DEFAULT_UNICODE_OS)
      if (typeof data.activeLayer === 'number') {
        setActiveLayer(data.activeLayer)
      }
      if (typeof data.selectedKeyId === 'string') {
        setSelectedKeyId(data.selectedKeyId)
      }
      setMagicHoldLetters(normalizeMagicLetters(data.magic?.holdLetters))
      setParseError('')
      setLastLoaded(file.name)
    } catch (error) {
      setParseError(error.message || 'Failed to load save file')
    }
  }

  useEffect(() => {
    if (!captureMode) return undefined
    const handleKeydown = (event) => {
      if (event.repeat) return
      if (isEditableElement(event.target)) return
      const modifierId = MODIFIER_KEY_MAP[event.code]
      if (modifierId) {
        captureModifiersRef.current.add(modifierId)
        return
      }
      const token = getCaptureToken(event)
      if (!token) return
      const lookupKey = normalizeToken(token)
      const bindingItem = bindingLookup.get(lookupKey)
      if (!bindingItem) return
      const currentKey = captureKeys[captureIndex]
      if (!currentKey) return
      event.preventDefault()
      const modifierIds = Array.from(captureModifiersRef.current)
      updateKeyBinding(currentKey.id, applyModifiersToItem(bindingItem, modifierIds))
      const nextIndex = captureIndex + 1 >= captureKeys.length ? 0 : captureIndex + 1
      setCaptureIndex(nextIndex)
      setSelectedKeyId(captureKeys[nextIndex]?.id || currentKey.id)
    }
    const handleKeyup = (event) => {
      const modifierId = MODIFIER_KEY_MAP[event.code]
      if (modifierId) {
        captureModifiersRef.current.delete(modifierId)
      }
    }
    window.addEventListener('keydown', handleKeydown)
    window.addEventListener('keyup', handleKeyup)
    return () => {
      window.removeEventListener('keydown', handleKeydown)
      window.removeEventListener('keyup', handleKeyup)
      captureModifiersRef.current.clear()
    }
  }, [bindingLookup, captureIndex, captureMode, captureKeys, activeLayer])

  const zmkKeymap = parsed.matrix
    ? formatZmkKeymap(visibleKeys, layers, magicHoldSet, defaultLayerZmk, unicodeOsZmk)
    : ''
  const zmkOverlayLeft = parsed.matrix ? formatZmkOverlay(parsed.matrix) : ''
  const zmkOverlayRight = parsed.matrix ? formatZmkOverlay(parsed.matrix) : ''
  const qmkInfo = parsed.matrix ? formatQmkInfo(visibleKeys, parsed.matrix) : ''
  const qmkKeymap = parsed.matrix
    ? formatQmkKeymap(visibleKeys, layers, magicHoldSet, defaultLayerQmk, unicodeOsQmk)
    : ''
  const qmkConfigH = parsed.matrix ? formatQmkConfigH(parsed.matrix) : ''
  const qmkRulesMk = parsed.matrix ? formatQmkRulesMk() : ''

  return (
    <div className="app">
      <header className="hero">
        <div>
          <h1>Keeber</h1>
          <p className="subtitle">
            Upload an ergogen YAML, edit layers and generate ZMK/QMK files
            ready for flashing.
          </p>
        </div>
        <div className="hero-actions">
          <label className="file">
            <input type="file" accept=".yaml,.yml" onChange={handleFile} />
            Upload YAML
          </label>
          <label className="file">
            <input type="file" accept=".json" onChange={handleLoadSave} />
            Load save file
          </label>
          <button className="ghost" onClick={handleSave} disabled={!parsed.matrix}>
            Save project
          </button>
          {lastLoaded ? <span className="meta">Loaded: {lastLoaded}</span> : null}
        </div>
      </header>

      {parsed.matrix ? (
        <>
          <main className="content">
          <section className="panel canvas">
          <div className="panel-header">
            <h2>Layout Preview</h2>
            <div className="panel-actions">
              <p>Click a key to assign bindings for the active layer.</p>
              <div className="capture-controls">
                <button
                  type="button"
                  className={captureMode ? 'primary' : 'ghost'}
                  onClick={captureMode ? stopCapture : startCapture}
                >
                  {captureMode ? 'Stop capture' : 'Capture keys'}
                </button>
                <label className="toggle capture-toggle">
                  <input
                    type="checkbox"
                    checked={captureRowDirection === 'desc'}
                    onChange={(event) =>
                      setCaptureRowDirection(event.target.checked ? 'desc' : 'asc')
                    }
                  />
                  Row decreases
                </label>
                <label className="toggle capture-toggle">
                  <input
                    type="checkbox"
                    checked={captureColDirection === 'desc'}
                    onChange={(event) =>
                      setCaptureColDirection(event.target.checked ? 'desc' : 'asc')
                    }
                  />
                  Column decreases
                </label>
                <div className="capture-status">
                  <span className={`capture-indicator ${captureMode ? 'active' : ''}`} />
                  {captureMode ? 'Listening' : 'Capture off'}
                </div>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={showGhosts}
                  onChange={(event) => setShowGhosts(event.target.checked)}
                />
                Show skipped keys
              </label>
            </div>
          </div>
          {parseError ? <p className="error">{parseError}</p> : null}
          {parsed.warnings.length > 0 ? (
            <div className="warnings">
              {parsed.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}
          <div className="matrix-info">
            <div>
              <span>Rows</span>
              <strong>{parsed.matrix ? parsed.matrix.rows.length : 0}</strong>
            </div>
            <div>
              <span>Cols</span>
              <strong>{parsed.matrix ? parsed.matrix.cols.length : 0}</strong>
            </div>
            <div>
              <span>Keys</span>
              <strong>{visibleKeys.length}</strong>
            </div>
            <div>
              <span>Mirror</span>
              <strong>{parsed.matrix?.mirrored ? 'Yes' : 'No'}</strong>
            </div>
          </div>
          <svg viewBox={viewBox} className="layout">
            <rect x="-9999" y="-9999" width="19998" height="19998" className="layout-bg" />
            {renderKeys.map((key) => {
              const isSelected = key.id === selectedKeyId
              const displayX = key.x
              const displayY = -key.y
              const displayRot = -key.rot
              const isGhost = key.skip
              const label = resolveKeyLabel(
                layer?.bindings[key.id]?.zmk,
                layer?.bindings[key.id]?.qmk,
                layers,
                labelLookup
              )
              const fontSize = computeKeyFontSize(label, key.unit)
              return (
                <g
                  key={key.id}
                  transform={`rotate(${displayRot} ${displayX} ${displayY})`}
                  onClick={() => {
                    if (!isGhost) {
                      setSelectedKeyId(key.id)
                      if (captureMode) {
                        const nextIndex = captureIndexById.get(key.id)
                        if (nextIndex !== undefined) setCaptureIndex(nextIndex)
                      }
                    }
                  }}
                  className={`key ${isSelected ? 'selected' : ''} ${isGhost ? 'ghost' : ''}`}
                >
                  <rect
                    x={displayX - key.unit / 2}
                    y={displayY - key.unit / 2}
                    width={key.unit}
                    height={key.unit}
                    rx={4}
                    ry={4}
                  />
                  {!isGhost ? (
                    <text x={displayX} y={displayY + 3} textAnchor="middle" style={{ fontSize }}>
                      {label}
                    </text>
                  ) : null}
                </g>
              )
            })}
          </svg>
          </section>

          <section className="panel inspector">
          <h2>Layer & Key Editor</h2>
          <div className="layers">
            <div className="layer-controls">
              <button className="ghost" onClick={addLayer}>Add layer</button>
              <button className="ghost" onClick={duplicateLayer}>Duplicate</button>
              <button className="ghost" onClick={removeLayer}>Remove</button>
            </div>
            <div className="layer-tabs">
              {layers.map((layerItem, index) => (
                <div
                  key={layerItem.id}
                  className={`layer-tab ${index === activeLayer ? 'active' : ''} ${
                    dragLayerIndex === index ? 'dragging' : ''
                  } ${dragOverLayerIndex === index ? 'drag-over' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveLayer(index)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setActiveLayer(index)
                    }
                  }}
                  draggable={index !== 0}
                  onDragStart={handleLayerDragStart(index)}
                  onDragOver={handleLayerDragOver(index)}
                  onDragEnter={handleLayerDragEnter(index)}
                  onDrop={handleLayerDrop(index)}
                  onDragEnd={handleLayerDragEnd}
                >
                  {index === activeLayer ? (
                    <input
                      className="layer-tab-input"
                      ref={activeLayerInputRef}
                      size={Math.max(layerItem.name.length, 2)}
                      value={layerItem.name}
                      onChange={(event) => renameLayer(event.target.value)}
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                      placeholder="Layer name"
                    />
                  ) : (
                    <span>{layerItem.name}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="key-editor">
            {selectedKey ? (
              <>
                <div className="key-meta">
                  <h3>{selectedKey.id}</h3>
                  <p>
                    Row: {selectedKey.row} ({selectedKey.row_net || 'no net'}) · Col:{' '}
                    {selectedKey.col} ({selectedKey.col_net || 'no net'})
                  </p>
                </div>
                <div className="binding-row">
                  <div className="field">
                    <label>ZMK binding</label>
                    <input value={binding?.zmk || '&none'} placeholder="&none" readOnly />
                  </div>
                  <div className="field">
                    <label>QMK binding</label>
                    <input value={binding?.qmk || 'KC_NO'} placeholder="KC_NO" readOnly />
                  </div>
                </div>
                <div className="palette">
                  <div className="modifier-row">
                    <div className="modifier-header">
                      <p className="palette-subtitle">Modifiers</p>
                      <button
                        type="button"
                        className="ghost"
                        onClick={clearModifierSelection}
                        disabled={modifierSelection.length === 0}
                      >
                        Clear
                      </button>
                    </div>
                    <div className="modifier-grid">
                      {MODIFIER_DEFS.map((modifier) => (
                        <button
                          key={modifier.id}
                          type="button"
                          className={`modifier-chip ${modifierSelectionSet.has(modifier.id) ? 'active' : ''}`}
                          onClick={() => toggleModifierSelection(modifier.id)}
                        >
                          {modifier.label}
                        </button>
                      ))}
                    </div>
                    <p className="modifier-note">Applies to palette selections.</p>
                  </div>
                  <div className="palette-tabs" role="tablist" aria-label="Key palette tabs">
                    {PALETTE_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={paletteTab === tab.id}
                        className={`palette-tab ${paletteTab === tab.id ? 'active' : ''}`}
                        onClick={() => setPaletteTab(tab.id)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  {activePaletteGroups.length ? (
                    <div className={`palette-groups ${paletteTab}`}>
                      {activePaletteGroups.map((group) => (
                        <div className="palette-group" key={group.title}>
                          <h4 className="palette-title">{group.title}</h4>
                          {group.title === 'Layers' ? (
                            <div className="layer-mode">
                              <p className="palette-subtitle">Layer key mode</p>
                              <div className="layer-mode-buttons">
                                {LAYER_MODES.map((mode) => (
                                  <button
                                    key={mode.id}
                                    type="button"
                                    className={layerMode === mode.id ? 'active' : ''}
                                    onClick={() => setLayerMode(mode.id)}
                                    title={mode.description}
                                  >
                                    {mode.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {group.sections.map((section) => (
                            <div className="palette-section" key={`${group.title}-${section.title}`}>
                              <p className="palette-subtitle">{section.title}</p>
                              <div className="palette-grid">
                                {section.items.map((item) => (
                                  <button
                                    key={`${group.title}-${section.title}-${item.label}`}
                                    onClick={() => applyPalette(item)}
                                  >
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {paletteTab === 'other' ? (
                    <>
                      <div className="unicode-settings">
                        <div>
                          <h4>Unicode key</h4>
                          <p>Send a Unicode code point from this key.</p>
                        </div>
                        <div className="unicode-row">
                          <div className="field unicode-input">
                            <label>Code point</label>
                            <div className="unicode-input-wrap">
                              <span className="unicode-prefix">U+</span>
                              <input
                                value={unicodeHexInput}
                                onChange={(event) => {
                                  const nextValue = event.target.value
                                  setUnicodeHexInput(nextValue)
                                  const normalized = normalizeUnicodeHexInput(nextValue)
                                  setUnicodeHexError(normalized.error)
                                }}
                                placeholder="1F600"
                              />
                            </div>
                          </div>
                          <div className="unicode-actions">
                            <button type="button" className="primary" onClick={applyUnicodeBinding}>
                              Apply Unicode
                            </button>
                            <button type="button" className="ghost" onClick={clearUnicodeBinding}>
                              Clear
                            </button>
                          </div>
                        </div>
                        {unicodeHexError ? (
                          <p className="unicode-error">{unicodeHexError}</p>
                        ) : null}
                      </div>
                      <div className="magic-settings">
                        <div className="magic-header">
                          <div>
                            <h3>Magic modifier</h3>
                            <p>Choose which alpha keys get the hold modifier on the Magic layer.</p>
                          </div>
                          <div className="magic-actions">
                            <button type="button" className="ghost" onClick={() => setMagicHoldLetters(MAGIC_LETTER_OPTIONS)}>
                              All
                            </button>
                            <button type="button" className="ghost" onClick={() => setMagicHoldLetters([])}>
                              None
                            </button>
                            <button
                              type="button"
                              className="ghost"
                              onClick={() => setMagicHoldLetters(DEFAULT_MAGIC_HOLD_LETTERS)}
                            >
                              Reset
                            </button>
                          </div>
                        </div>
                        <div className="magic-grid">
                          {MAGIC_LETTER_OPTIONS.map((letter) => (
                            <button
                              key={letter}
                              type="button"
                              className={`magic-letter ${magicHoldSet.has(letter) ? 'active' : ''}`}
                              onClick={() => toggleMagicLetter(letter)}
                            >
                              {letter}
                            </button>
                          ))}
                        </div>
                        <p className="magic-note">Only affects keys whose base layer binding is the matching letter.</p>
                      </div>
                    </>
                  ) : null}
                </div>
              </>
              ) : (
                <p>Select a key on the layout to edit bindings.</p>
              )}
          </div>
          </section>
        </main>

        <section className="panel export-panel">
        <div className="panel-header">
          <div>
            <h2>Export & Flashing</h2>
            <p>Choose a firmware target, then download and flash.</p>
          </div>
          <button
            className={`export-toggle ${exportTarget}`}
            type="button"
            aria-label="Toggle firmware target"
            onClick={() =>
              setExportTarget((current) => (current === 'zmk' ? 'qmk' : 'zmk'))
            }
          >
            <span className={`toggle-option ${exportTarget === 'zmk' ? 'active' : ''}`}>ZMK</span>
            <span className={`toggle-option ${exportTarget === 'qmk' ? 'active' : ''}`}>QMK</span>
          </button>
        </div>
        {exportTarget === 'zmk' ? (
          <div className="export-body">
            <div className="field export-field">
              <label>Default layer (ZMK)</label>
              <select
                value={defaultLayerZmk}
                onChange={(event) =>
                  setDefaultLayerZmk(clampLayerIndex(Number(event.target.value), layers))
                }
              >
                {layers.map((layerItem, index) => (
                  <option key={layerItem.id} value={index}>
                    {layerItem.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field export-field">
              <label>Unicode OS (ZMK)</label>
              <select value={unicodeOsZmk} onChange={(event) => setUnicodeOsZmk(event.target.value)}>
                {UNICODE_OS_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="export-actions">
              <button
                className="primary"
                onClick={() => downloadFile('keymap.keymap', zmkKeymap)}
                disabled={!parsed.matrix}
              >
                Download keymap.keymap
              </button>
              <button
                className="ghost"
                onClick={() => downloadFile('config.left.overlay', zmkOverlayLeft)}
                disabled={!parsed.matrix}
              >
                Download config.left.overlay
              </button>
              <button
                className="ghost"
                onClick={() => downloadFile('config.right.overlay', zmkOverlayRight)}
                disabled={!parsed.matrix}
              >
                Download config.right.overlay
              </button>
            </div>
            <div className="flash-instructions">
              <h3>Flashing Instructions</h3>
              <div className="flash-steps">
                <div className="flash-step">
                  <p className="step-title">1. Add the files to your ZMK config repo</p>
                  <p className="step-detail">
                    Place `keymap.keymap`, `config.left.overlay`, and `config.right.overlay` in your config folder.
                    The left side is treated as the central (master) half for Bluetooth splits.
                  </p>
                </div>
                <div className="flash-step">
                  <p className="step-title">2. Build the left (central) firmware</p>
                  <pre>
                    <code>west build -d build/left -b your_board -S zmk,keyboard -- -DOVERLAY_CONFIG=config.left.overlay</code>
                  </pre>
                </div>
                <div className="flash-step">
                  <p className="step-title">3. Build the right (peripheral) firmware</p>
                  <pre>
                    <code>west build -d build/right -b your_board -S zmk,keyboard -- -DOVERLAY_CONFIG=config.right.overlay</code>
                  </pre>
                </div>
                <div className="flash-step">
                  <p className="step-title">4. Flash left, then right</p>
                  <pre>
                    <code>west flash -d build/left
west flash -d build/right</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="export-body">
            <div className="field export-field">
              <label>Default layer (QMK)</label>
              <select
                value={defaultLayerQmk}
                onChange={(event) =>
                  setDefaultLayerQmk(clampLayerIndex(Number(event.target.value), layers))
                }
              >
                {layers.map((layerItem, index) => (
                  <option key={layerItem.id} value={index}>
                    {layerItem.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field export-field">
              <label>Unicode OS (QMK)</label>
              <select value={unicodeOsQmk} onChange={(event) => setUnicodeOsQmk(event.target.value)}>
                {UNICODE_OS_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="export-actions">
              <button
                className="primary"
                onClick={() => downloadFile('keymap.c', qmkKeymap)}
                disabled={!parsed.matrix}
              >
                Download keymap.c
              </button>
              <button
                className="ghost"
                onClick={() => downloadFile('info.json', qmkInfo)}
                disabled={!parsed.matrix}
              >
                Download info.json
              </button>
              <button
                className="ghost"
                onClick={() => downloadFile('config.h', qmkConfigH)}
                disabled={!parsed.matrix}
              >
                Download config.h
              </button>
              <button
                className="ghost"
                onClick={() => downloadFile('rules.mk', qmkRulesMk)}
                disabled={!parsed.matrix}
              >
                Download rules.mk
              </button>
            </div>
            <div className="flash-instructions">
              <h3>Flashing Instructions</h3>
              <div className="flash-steps">
                <div className="flash-step">
                  <p className="step-title">1. Copy the generated files</p>
                  <p className="step-detail">
                    Move `keymap.c` into `keyboards/your_kb/keymaps/your_keymap` and merge `info.json`.
                    Add `config.h` and `rules.mk` to your keyboard folder (or merge into existing files).
                  </p>
                </div>
                <div className="flash-step">
                  <p className="step-title">2. Compile the firmware</p>
                  <pre>
                    <code>qmk compile -kb your_kb -km your_keymap</code>
                  </pre>
                </div>
                <div className="flash-step">
                  <p className="step-title">3. Flash left (master), then right</p>
                  <pre>
                    <code>qmk flash -kb your_kb -km your_keymap
qmk flash -kb your_kb -km your_keymap</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
        </section>
        </>
      ) : null}
    </div>
  )
}

export default App
