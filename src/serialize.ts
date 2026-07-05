import type { Key, Keyboard } from './types'
import { clone, DEFAULT_KEY, DEFAULT_METADATA, DISALLOWED_ALIGNMENT_FOR_LABELS, LABEL_MAP, roundTo4 } from './types'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isEmptyObject(obj: object): boolean {
  return Object.keys(obj).length === 0
}

function serializeProp(props: Record<string, unknown>, name: string, val: unknown, defval: unknown): unknown {
  if (val !== defval)
    props[name] = val
  return val
}

// ---------------------------------------------------------------------------
// sortKeys
// ---------------------------------------------------------------------------

export function sortKeys(keys: Key[]): Key[] {
  return [...keys].sort((a, b) =>
    ((a.rotation_angle + 360) % 360 - (b.rotation_angle + 360) % 360)
    || (a.rotation_x - b.rotation_x)
    || (a.rotation_y - b.rotation_y)
    || (a.y - b.y)
    || (a.x - b.x),
  )
}

// ---------------------------------------------------------------------------
// reorderLabels (internal)
// ---------------------------------------------------------------------------

interface ReorderResult {
  align: number
  labels: string[]
  textColor: string[]
  textSize: (number | undefined)[]
}

function reorderLabels(key: Key, current: { textSize: (number | undefined)[] }): ReorderResult {
  const alignPrefs = [7, 5, 6, 4, 3, 1, 2, 0]
  const align = [...alignPrefs]

  for (let i = 0; i < key.labels.length; ++i) {
    if (key.labels[i]) {
      for (const disallowed of DISALLOWED_ALIGNMENT_FOR_LABELS[i]) {
        const idx = align.indexOf(disallowed)
        if (idx >= 0)
          align.splice(idx, 1)
      }
    }
  }

  const ret: ReorderResult = {
    align: align[0] ?? 4,
    labels: Array.from({ length: 12 }).fill(''),
    textColor: Array.from({ length: 12 }).fill(''),
    textSize: [],
  }

  for (let i = 0; i < 12; ++i) {
    const ndx = LABEL_MAP[ret.align].indexOf(i)
    if (ndx >= 0) {
      if (key.labels[i])
        ret.labels[ndx] = key.labels[i]
      if (key.textColor[i])
        ret.textColor[ndx] = key.textColor[i]!
      if (key.textSize[i])
        ret.textSize[ndx] = key.textSize[i]
    }
  }

  for (let i = 0; i < ret.textSize.length; ++i) {
    if (!ret.labels[i])
      ret.textSize[i] = current.textSize[i]
    if (!ret.textSize[i] || ret.textSize[i] === key.default.textSize)
      ret.textSize[i] = 0
  }

  return ret
}

// ---------------------------------------------------------------------------
// compareTextSizes (internal)
// ---------------------------------------------------------------------------

function compareTextSizes(
  current: number | (number | undefined)[],
  key: (number | undefined)[],
  labels: string[],
): boolean {
  if (typeof current === 'number')
    current = [current]
  for (let i = 0; i < 12; ++i) {
    if (labels[i] && ((!!current[i] !== !!key[i]) || (current[i] && current[i] !== key[i])))
      return false
  }
  return true
}

// ---------------------------------------------------------------------------
// serialize
// ---------------------------------------------------------------------------

interface SerializeCurrent {
  rotation_angle: number
  rotation_x: number
  rotation_y: number
  x: number
  y: number
  color: string
  textColor: string
  ghost: boolean
  profile: string
  sm: string
  sb: string
  st: string
  align: number
  default: { textColor: string, textSize: number }
  textSize: (number | undefined)[]
  labels: string[]
  width: number
  height: number
}

export function serialize(keyboard: Keyboard): unknown[] {
  const keys = sortKeys(keyboard.keys)
  const rows: unknown[] = []
  let row: unknown[] = []

  const current: SerializeCurrent = {
    ...clone(DEFAULT_KEY),
    textColor: DEFAULT_KEY.default.textColor,
    align: 4,
  }
  const cluster = { r: 0, rx: 0, ry: 0 }

  // Metadata: only include non-default values
  const meta: Record<string, unknown> = {}
  for (const metakey in keyboard.meta) {
    serializeProp(meta, metakey, keyboard.meta[metakey], (DEFAULT_METADATA as Record<string, unknown>)[metakey])
  }
  if (!isEmptyObject(meta))
    rows.push(meta)

  let newRow = true
  current.y-- // will be incremented on first row

  for (const key of keys) {
    const props: Record<string, unknown> = {}
    const ordered = reorderLabels(key, current)

    const clusterChanged = key.rotation_angle !== cluster.r || key.rotation_x !== cluster.rx || key.rotation_y !== cluster.ry
    const rowChanged = key.y !== current.y
    if (row.length > 0 && (rowChanged || clusterChanged)) {
      rows.push(row)
      row = []
      newRow = true
    }

    if (newRow) {
      current.y++
      // y resets if either rx or ry changed
      if (key.rotation_y !== cluster.ry || key.rotation_x !== cluster.rx)
        current.y = key.rotation_y
      current.x = key.rotation_x
      cluster.r = key.rotation_angle
      cluster.rx = key.rotation_x
      cluster.ry = key.rotation_y
      newRow = false
    }

    current.rotation_angle = serializeProp(props, 'r', roundTo4(key.rotation_angle), current.rotation_angle) as number
    current.rotation_x = serializeProp(props, 'rx', roundTo4(key.rotation_x), current.rotation_x) as number
    current.rotation_y = serializeProp(props, 'ry', roundTo4(key.rotation_y), current.rotation_y) as number
    current.y += serializeProp(props, 'y', roundTo4(key.y - current.y), 0) as number
    current.x += serializeProp(props, 'x', roundTo4(key.x - current.x), 0) as number + key.width
    current.color = serializeProp(props, 'c', key.color, current.color) as string

    // Fill in textColor defaults for the serialized newline-joined format
    if (!ordered.textColor[0]) {
      ordered.textColor[0] = key.default.textColor
    }
    else {
      for (let i = 2; i < 12; ++i) {
        // Fixed reference bug: was !== (no-op comparison), now = (assignment)
        if (!ordered.textColor[i] && ordered.textColor[i] !== ordered.textColor[0]) {
          ordered.textColor[i] = key.default.textColor
        }
      }
    }
    current.textColor = serializeProp(props, 't', ordered.textColor.join('\n').trimEnd(), current.textColor) as string

    current.ghost = serializeProp(props, 'g', key.ghost, current.ghost) as boolean
    current.profile = serializeProp(props, 'p', key.profile, current.profile) as string
    current.sm = serializeProp(props, 'sm', key.sm, current.sm) as string
    current.sb = serializeProp(props, 'sb', key.sb, current.sb) as string
    current.st = serializeProp(props, 'st', key.st, current.st) as string
    current.align = serializeProp(props, 'a', ordered.align, current.align) as number
    current.default.textSize = serializeProp(props, 'f', key.default.textSize, current.default.textSize) as number
    if (props.f)
      current.textSize = []

    if (!compareTextSizes(current.textSize, ordered.textSize, ordered.labels)) {
      if (ordered.textSize.length === 0) {
        // Force 'f' to be written so the parser resets textSize
        serializeProp(props, 'f', key.default.textSize, -1)
      }
      else {
        let optimizeF2 = !ordered.textSize[0]
        for (let i = 2; i < ordered.textSize.length && optimizeF2; ++i) {
          optimizeF2 = ordered.textSize[i] === ordered.textSize[1]
        }
        if (optimizeF2) {
          const f2 = ordered.textSize[1]
          serializeProp(props, 'f2', f2, -1)
          current.textSize = [0, f2, f2, f2, f2, f2, f2, f2, f2, f2, f2, f2]
        }
        else {
          current.textSize = serializeProp(props, 'fa', ordered.textSize, []) as (number | undefined)[]
        }
      }
    }

    serializeProp(props, 'w', roundTo4(key.width), 1)
    serializeProp(props, 'h', roundTo4(key.height), 1)
    serializeProp(props, 'w2', roundTo4(key.width2), roundTo4(key.width))
    serializeProp(props, 'h2', roundTo4(key.height2), roundTo4(key.height))
    serializeProp(props, 'x2', roundTo4(key.x2), 0)
    serializeProp(props, 'y2', roundTo4(key.y2), 0)
    serializeProp(props, 'n', key.nub || false, false)
    serializeProp(props, 'l', key.stepped || false, false)
    serializeProp(props, 'd', key.decal || false, false)

    if (!isEmptyObject(props))
      row.push(props)
    current.labels = ordered.labels
    row.push(ordered.labels.join('\n').trimEnd())
  }

  if (row.length > 0)
    rows.push(row)

  return rows
}
