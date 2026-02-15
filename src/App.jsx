import { useMemo, useState } from 'react'
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

const parseBindingToken = (binding) => {
  if (!binding) return ''
  const trimmed = binding.trim()
  if (!trimmed || trimmed === '&none' || trimmed === 'KC_NO') return ''

  if (trimmed.startsWith('&kp')) {
    const parts = trimmed.split(/\s+/)
    return parts[1] || ''
  }

  if (trimmed.startsWith('&mo')) {
    const parts = trimmed.split(/\s+/)
    return parts[1] ? `L${parts[1]}` : ''
  }

  const moMatch = /MO\((\d+)\)/.exec(trimmed)
  if (moMatch) return `L${moMatch[1]}`

  const kcMatch = /KC_([A-Z0-9_]+)/.exec(trimmed)
  if (kcMatch) return kcMatch[1]

  return trimmed
}

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

const resolveKeyLabel = (zmk, qmk, layers, labelLookup) => {
  const canonical =
    findCanonicalLabel(zmk, labelLookup) ||
    findCanonicalLabel(qmk, labelLookup)
  const label = canonical || formatKeyLabel(zmk) || formatKeyLabel(qmk)
  const layerMatch = /^L(\d+)$/.exec(label)
  if (layerMatch) {
    const index = Number(layerMatch[1])
    return layers?.[index]?.name || label
  }
  return label
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

  const zoneEntries = Object.entries(zones)
  zoneEntries.forEach(([zoneName, zone], zoneIndex) => {
    const anchor = zone?.anchor || {}
    const anchorShift = anchor.shift || [0, 0]
    const zoneRotate = toNumber(anchor.rotate, 0) + toNumber(zone.rotate, 0) + globalRotate
    let anchorX = toNumber(anchorShift[0], 0)
    let anchorY = toNumber(anchorShift[1], 0)

    if (anchor.ref) {
      const refKey = keyById[anchor.ref]
      if (refKey) {
        anchorX += refKey.x
        anchorY += refKey.y
      } else {
        warnings.push(`Anchor ref ${anchor.ref} not found for zone ${zoneName}`)
      }
    }

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
    colEntries.forEach(([colName, column]) => {
      if (colIndexByName[colName] === undefined) {
        colIndexByName[colName] = colList.length
        colList.push({ name: colName, net: column?.key?.column_net || '' })
      }
      const columnKey = column?.key || {}
      const spread = toNumber(columnKey.spread ?? zone?.key?.spread ?? unit, unit)
      const stagger = toNumber(columnKey.stagger ?? zone?.key?.stagger ?? 0, 0)
      const colRows = column?.rows || {}

      columnY += stagger

      rowNames.forEach((rowName, rowIndex) => {
        const rowInfo = rows[rowName] || {}
        const rowEntry = colRows[rowName] || {}
        const isSkipped = rowEntry?.skip === true || rowEntry?.key?.skip === true
        const localX = columnX
        const localY = columnY + rowIndex * unit
        const rotated = rotatePoint(localX, localY, zoneRotate)
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
          rot: zoneRotate,
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
    mirrored: Boolean(mirror)
  }

  return { keys, matrix, warnings, bounds }
}

const createLayer = (index) => ({
  id: `layer-${index}`,
  name: index === 0 ? 'Base' : `Layer ${index}`,
  bindings: {}
})

const ensureLayers = (layers, keys) => {
  if (layers.length === 0) {
    return [createLayer(0)]
  }
  return layers.map((layer) => ({
    ...layer,
    bindings: { ...layer.bindings }
  }))
}

const buildLayerPalette = (layers) =>
  layers.slice(1).map((layer, index) => {
    const layerIndex = index + 1
    return {
      label: layer.name,
      zmk: `&mo ${layerIndex}`,
      qmk: `MO(${layerIndex})`
    }
  })

const getLayerIndexFromBinding = (value) => {
  if (!value) return null
  const trimmed = value.trim()
  const zmkMatch = /^&mo\s+(\d+)$/.exec(trimmed)
  if (zmkMatch) return { index: Number(zmkMatch[1]), type: 'zmk' }
  const qmkMatch = /^MO\((\d+)\)$/.exec(trimmed)
  if (qmkMatch) return { index: Number(qmkMatch[1]), type: 'qmk' }
  return null
}

const updateLayerBinding = (value, removedIndex) => {
  if (!value) return value
  const parsed = getLayerIndexFromBinding(value)
  if (!parsed) return value
  const { index, type } = parsed
  if (index === removedIndex) return ''
  if (index > removedIndex) {
    const nextIndex = index - 1
    return type === 'zmk' ? `&mo ${nextIndex}` : `MO(${nextIndex})`
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
  const { index, type } = parsed
  if (indexMap[index] === undefined) return value
  const nextIndex = indexMap[index]
  return type === 'zmk' ? `&mo ${nextIndex}` : `MO(${nextIndex})`
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

const formatZmkKeymap = (keys, layers) => {
  const layerBlocks = layers.map((layer, index) => {
    const bindings = keys.map((key) => layer.bindings[key.id]?.zmk || '&none').join(' ')
    return `    layer_${index} {\n      label = "${layer.name}";\n      bindings = < ${bindings} >;\n    };`
  })
  return `/ {\n  keymap {\n    compatible = "zmk,keymap";\n    default_layer = <0>;\n    layers {\n${layerBlocks.join('\n')}\n    };\n  };\n};\n`
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

const formatQmkKeymap = (keys, layers) => {
  const layerBlocks = layers
    .map((layer, layerIndex) => {
      const keycodes = keys.map((key) => layer.bindings[key.id]?.qmk || 'KC_NO')
      return `  [${layerIndex}] = LAYOUT(\n    ${keycodes.join(',\n    ')}\n  )`
    })
    .join(',\n')

  return `#include QMK_KEYBOARD_H\n\nconst uint16_t PROGMEM keymaps[][MATRIX_ROWS][MATRIX_COLS] = {\n${layerBlocks}\n};\n`
}

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

function App() {
  const [parseError, setParseError] = useState('')
  const [parsed, setParsed] = useState({ keys: [], matrix: null, warnings: [], bounds: null })
  const [layers, setLayers] = useState([createLayer(0)])
  const [activeLayer, setActiveLayer] = useState(0)
  const [selectedKeyId, setSelectedKeyId] = useState(null)
  const [showGhosts, setShowGhosts] = useState(false)
  const [lastLoaded, setLastLoaded] = useState('')
  const [dragLayerIndex, setDragLayerIndex] = useState(null)
  const [dragOverLayerIndex, setDragOverLayerIndex] = useState(null)
  const [exportTarget, setExportTarget] = useState('zmk')

  const visibleKeys = useMemo(() => parsed.keys.filter((key) => !key.skip), [parsed.keys])
  const selectedKey = useMemo(
    () => visibleKeys.find((key) => key.id === selectedKeyId) || null,
    [visibleKeys, selectedKeyId]
  )

  const layer = layers[activeLayer]
  const binding = selectedKey ? layer?.bindings[selectedKey.id] : null
  const registryItems = useMemo(() => flattenKeyGroups(KEY_GROUPS), [])
  const labelLookup = useMemo(() => buildLabelLookup(registryItems), [registryItems])
  const paletteGroups = useMemo(() => {
    const groups = KEY_GROUPS.map((group) => ({
      title: group.title,
      sections: group.sections
    }))
    const layerItems = buildLayerPalette(layers)
    if (layerItems.length) {
      groups.push({
        title: 'Layers',
        sections: [{ title: 'Layers', items: layerItems }]
      })
    }
    return groups
  }, [layers])

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

  const applyPalette = (item) => {
    if (!selectedKey) return
    setLayers((prev) =>
      prev.map((layerItem, index) => {
        if (index !== activeLayer) return layerItem
        return {
          ...layerItem,
          bindings: {
            ...layerItem.bindings,
            [selectedKey.id]: { zmk: item.zmk, qmk: item.qmk }
          }
        }
      })
    )
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
      const next = prev.filter((_, index) => index !== activeLayer)
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
      const { nextLayers, indexMap } = reorderLayers(prev, fromIndex, targetIndex)
      setActiveLayer((current) => indexMap[current] ?? current)
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

  const handleSave = () => {
    if (!parsed.matrix) return
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
      selectedKeyId
    }
    downloadFile('keyboard-config.kb.json', JSON.stringify(payload, null, 2), 'application/json')
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
      }
      if (typeof data.activeLayer === 'number') {
        setActiveLayer(data.activeLayer)
      }
      if (typeof data.selectedKeyId === 'string') {
        setSelectedKeyId(data.selectedKeyId)
      }
      setParseError('')
      setLastLoaded(file.name)
    } catch (error) {
      setParseError(error.message || 'Failed to load save file')
    }
  }

  const zmkKeymap = parsed.matrix ? formatZmkKeymap(visibleKeys, layers) : ''
  const zmkOverlay = parsed.matrix ? formatZmkOverlay(parsed.matrix) : ''
  const qmkInfo = parsed.matrix ? formatQmkInfo(visibleKeys, parsed.matrix) : ''
  const qmkKeymap = parsed.matrix ? formatQmkKeymap(visibleKeys, layers) : ''

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

      <main className="content">
        <section className="panel canvas">
          <div className="panel-header">
            <h2>Layout Preview</h2>
            <div className="panel-actions">
              <p>Click a key to assign bindings for the active layer.</p>
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
                    if (!isGhost) setSelectedKeyId(key.id)
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
                <button
                  key={layerItem.id}
                  className={`layer-tab ${index === activeLayer ? 'active' : ''} ${
                    dragLayerIndex === index ? 'dragging' : ''
                  } ${dragOverLayerIndex === index ? 'drag-over' : ''}`}
                  onClick={() => setActiveLayer(index)}
                  draggable={index !== 0}
                  onDragStart={handleLayerDragStart(index)}
                  onDragOver={handleLayerDragOver(index)}
                  onDragEnter={handleLayerDragEnter(index)}
                  onDrop={handleLayerDrop(index)}
                  onDragEnd={handleLayerDragEnd}
                >
                  {layerItem.name}
                </button>
              ))}
            </div>
            <input
              className="layer-name"
              value={layer?.name || ''}
              onChange={(event) => renameLayer(event.target.value)}
              placeholder="Layer name"
            />
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
                <div className="field">
                  <label>ZMK binding</label>
                  <input
                    value={binding?.zmk || ''}
                    onChange={(event) => updateBinding('zmk', event.target.value)}
                    placeholder="&kp A"
                  />
                </div>
                <div className="field">
                  <label>QMK keycode</label>
                  <input
                    value={binding?.qmk || ''}
                    onChange={(event) => updateBinding('qmk', event.target.value)}
                    placeholder="KC_A"
                  />
                </div>
                <div className="palette">
                  {paletteGroups.map((group) => (
                    <div className="palette-group" key={group.title}>
                      <h4 className="palette-title">{group.title}</h4>
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
                onClick={() => downloadFile('config.overlay', zmkOverlay)}
                disabled={!parsed.matrix}
              >
                Download config.overlay
              </button>
            </div>
            <div className="flash-instructions">
              <h3>Flashing Instructions</h3>
              <div className="flash-steps">
                <div className="flash-step">
                  <p className="step-title">1. Add the files to your ZMK config repo</p>
                  <p className="step-detail">Place `keymap.keymap` and `config.overlay` in your config folder.</p>
                </div>
                <div className="flash-step">
                  <p className="step-title">2. Build the firmware</p>
                  <pre>
                    <code>west build -d build/left -b your_board -S zmk,keyboard</code>
                  </pre>
                </div>
                <div className="flash-step">
                  <p className="step-title">3. Flash to the board</p>
                  <pre>
                    <code>west flash</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="export-body">
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
            </div>
            <div className="flash-instructions">
              <h3>Flashing Instructions</h3>
              <div className="flash-steps">
                <div className="flash-step">
                  <p className="step-title">1. Copy the generated files</p>
                  <p className="step-detail">
                    Move `keymap.c` into `keyboards/your_kb/keymaps/your_keymap` and merge `info.json`.
                  </p>
                </div>
                <div className="flash-step">
                  <p className="step-title">2. Compile the firmware</p>
                  <pre>
                    <code>qmk compile -kb your_kb -km your_keymap</code>
                  </pre>
                </div>
                <div className="flash-step">
                  <p className="step-title">3. Flash to the board</p>
                  <pre>
                    <code>qmk flash -kb your_kb -km your_keymap</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

export default App
