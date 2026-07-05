import { z } from 'zod'

// ---------------------------------------------------------------------------
// Label alignment maps
// Maps from serialized label position to normalized position, depending on
// alignment flags (0–7).  -1 means the position is unused for that alignment.
// Source: keyboard-layout-editor serial.js:47–57
// ---------------------------------------------------------------------------

export const LABEL_MAP: readonly (readonly number[])[] = [
  // 0  1  2  3  4  5  6  7  8  9 10 11   // align flags
  [0, 6, 2, 8, 9, 11, 3, 5, 1, 4, 7, 10], // 0 = no centering
  [1, 7, -1, -1, 9, 11, 4, -1, -1, -1, -1, 10], // 1 = center x
  [3, -1, 5, -1, 9, 11, -1, -1, 4, -1, -1, 10], // 2 = center y
  [4, -1, -1, -1, 9, 11, -1, -1, -1, -1, -1, 10], // 3 = center x & y
  [0, 6, 2, 8, 10, -1, 3, 5, 1, 4, 7, -1], // 4 = center front (default)
  [1, 7, -1, -1, 10, -1, 4, -1, -1, -1, -1, -1], // 5 = center front & x
  [3, -1, 5, -1, 10, -1, -1, -1, 4, -1, -1, -1], // 6 = center front & y
  [4, -1, -1, -1, 10, -1, -1, -1, -1, -1, -1, -1], // 7 = center front & x & y
] as const

// Disallowed alignment flags for each label position (0–11).
// Used during serialization to find the optimal alignment flag.
// Source: keyboard-layout-editor serial.js:58–71
export const DISALLOWED_ALIGNMENT_FOR_LABELS: readonly (readonly number[])[] = [
  [1, 2, 3, 5, 6, 7], // 0
  [2, 3, 6, 7], // 1
  [1, 2, 3, 5, 6, 7], // 2
  [1, 3, 5, 7], // 3
  [], // 4
  [1, 3, 5, 7], // 5
  [1, 2, 3, 5, 6, 7], // 6
  [2, 3, 6, 7], // 7
  [1, 2, 3, 5, 6, 7], // 8
  [4, 5, 6, 7], // 9
  [], // 10
  [4, 5, 6, 7], // 11
] as const

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

export const DEFAULT_KEY: Readonly<Key> = {
  x: 0,
  y: 0,
  x2: 0,
  y2: 0,
  width: 1,
  height: 1,
  width2: 1,
  height2: 1,
  rotation_angle: 0,
  rotation_x: 0,
  rotation_y: 0,
  labels: [],
  textColor: [],
  textSize: [],
  default: { textColor: '#000000', textSize: 3 },
  color: '#cccccc',
  profile: '',
  nub: false,
  ghost: false,
  stepped: false,
  decal: false,
  sm: '',
  sb: '',
  st: '',
} as const

export const DEFAULT_METADATA: Readonly<KeyboardMetadata> = {
  backcolor: '#eeeeee',
  name: '',
  author: '',
  notes: '',
  background: undefined,
  radii: '',
  switchMount: '',
  switchBrand: '',
  switchType: '',
} as const

// ---------------------------------------------------------------------------
// Output types (plain TypeScript interfaces — no Zod runtime cost)
// ---------------------------------------------------------------------------

export interface Key {
  x: number
  y: number
  x2: number
  y2: number
  width: number
  height: number
  width2: number
  height2: number
  rotation_angle: number
  rotation_x: number
  rotation_y: number
  labels: string[]
  textColor: (string | undefined)[]
  textSize: (number | undefined)[]
  default: { textColor: string, textSize: number }
  color: string
  profile: string
  nub: boolean
  ghost: boolean
  stepped: boolean
  decal: boolean
  sm: string
  sb: string
  st: string
}

export interface KeyboardMetadata {
  backcolor: string
  name: string
  author: string
  notes: string
  background: { name: string, style: string } | undefined
  radii: string
  switchMount: string
  switchBrand: string
  switchType: string
  // Passthrough: unknown metadata properties are preserved
  [key: string]: unknown
}

export interface Keyboard {
  meta: KeyboardMetadata
  keys: Key[]
}

// ---------------------------------------------------------------------------
// Zod input schemas (for runtime validation of raw JSON)
// ---------------------------------------------------------------------------

export const RawKeyPropsSchema = z.object({
  r: z.number().optional(),
  rx: z.number().optional(),
  ry: z.number().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  w: z.number().optional(),
  h: z.number().optional(),
  x2: z.number().optional(),
  y2: z.number().optional(),
  w2: z.number().optional(),
  h2: z.number().optional(),
  c: z.string().optional(),
  t: z.string().optional(),
  p: z.string().optional(),
  a: z.number().min(0).max(7).optional(),
  f: z.number().optional(),
  f2: z.number().optional(),
  fa: z.array(z.union([z.number(), z.null(), z.undefined()])).max(12).optional().transform(arr => arr?.map(v => v === null ? undefined : v)),
  g: z.boolean().optional(),
  n: z.boolean().optional(),
  l: z.boolean().optional(),
  d: z.boolean().optional(),
  sm: z.string().optional(),
  sb: z.string().optional(),
  st: z.string().optional(),
}).strip() // Silently drop unknown key properties

export type RawKeyProps = z.infer<typeof RawKeyPropsSchema>

// ---------------------------------------------------------------------------
// Internal: mutable "current state" used during parsing
// ---------------------------------------------------------------------------

export interface CurrentKeyState extends Key {
  align: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deep-clone a plain object (no class instances, no circular refs). */
export function clone<T>(o: T): T {
  if (o === null || typeof o !== 'object')
    return o
  if (Array.isArray(o))
    return o.map(item => clone(item)) as unknown as T
  const result = {} as Record<string, unknown>
  for (const prop in o) {
    if (Object.hasOwn(o, prop))
      result[prop] = clone((o as Record<string, unknown>)[prop])
  }
  return result as T
}

/** Create a fresh mutable key state from defaults. */
export function createCurrentState(): CurrentKeyState {
  return {
    ...clone(DEFAULT_KEY),
    align: 4,
  }
}

/** Reorder labels from serialized order to normalized order. */
export function reorderLabelsIn(labels: (string | undefined)[], align: number, skipDefault = false): (string | undefined)[] {
  const ret: (string | undefined)[] = []
  const start = skipDefault ? 1 : 0
  for (let i = start; i < labels.length; ++i) {
    const targetIndex = LABEL_MAP[align][i]
    if (targetIndex >= 0)
      ret[targetIndex] = labels[i]
  }
  return ret
}

/** Round a number to 4 decimal places (for serialization parity). */
export function roundTo4(n: number): number {
  return Math.round(n * 10000) / 10000
}
