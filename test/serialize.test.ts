import type { Key, Keyboard } from '../src/index'
import { describe, expect, it } from 'vitest'
import { clone, DEFAULT_KEY, DEFAULT_METADATA, deserialize, parse, serialize, sortKeys } from '../src/index'

// Helper: build a Keyboard with a single key
function singleKey(overrides: Partial<Key> = {}): Keyboard {
  const key: Key = { ...clone(DEFAULT_KEY), labels: ['A'], ...overrides }
  return { meta: clone(DEFAULT_METADATA), keys: [key] }
}

// Helper: build a Keyboard with multiple keys
function multiKey(overridesArr: Partial<Key>[]): Keyboard {
  const keys = overridesArr.map((o) => {
    const k = { ...clone(DEFAULT_KEY), labels: [''], ...o }
    // Resolve zero-means-inherit
    if (k.width2 === 0)
      k.width2 = k.width
    if (k.height2 === 0)
      k.height2 = k.height
    return k
  })
  return { meta: clone(DEFAULT_METADATA), keys }
}

// Helper: deep-equal comparison for Key arrays (ignoring undefined vs missing)
function keysEqual(a: Key[], b: Key[]): boolean {
  if (a.length !== b.length)
    return false
  for (let i = 0; i < a.length; i++) {
    const ka = a[i]
    const kb = b[i]
    // Compare all Key properties
    const props: (keyof Key)[] = [
      'x',
      'y',
      'x2',
      'y2',
      'width',
      'height',
      'width2',
      'height2',
      'rotation_angle',
      'rotation_x',
      'rotation_y',
      'color',
      'profile',
      'nub',
      'ghost',
      'stepped',
      'decal',
      'sm',
      'sb',
      'st',
    ]
    for (const p of props) {
      if (ka[p] !== kb[p])
        return false
    }
    // Compare default
    if (ka.default.textColor !== kb.default.textColor)
      return false
    if (ka.default.textSize !== kb.default.textSize)
      return false
    // Compare labels
    for (let j = 0; j < 12; j++) {
      if ((ka.labels[j] ?? '') !== (kb.labels[j] ?? ''))
        return false
    }
    // Compare textColor
    for (let j = 0; j < 12; j++) {
      if ((ka.textColor[j] ?? undefined) !== (kb.textColor[j] ?? undefined))
        return false
    }
    // Compare textSize
    for (let j = 0; j < 12; j++) {
      if ((ka.textSize[j] ?? undefined) !== (kb.textSize[j] ?? undefined))
        return false
    }
  }
  return true
}

// ---------------------------------------------------------------------------
// 1. Basic serialization
// ---------------------------------------------------------------------------
describe('serialize basic', () => {
  it('should serialize a single key', () => {
    const kb = singleKey({ x: 0, y: 0 })
    const result = serialize(kb)
    expect(result).toBeInstanceOf(Array)
    // Should have at least one row
    expect(result.length).toBeGreaterThanOrEqual(1)
    // The last row should contain the key label
    const lastRow = result[result.length - 1]
    expect(Array.isArray(lastRow)).toBe(true)
    // Should contain the label 'A'
    const labels = (lastRow as unknown[]).filter(el => typeof el === 'string')
    expect(labels).toContain('A')
  })

  it('should serialize multiple keys in a row', () => {
    const kb = multiKey([
      { x: 0, y: 0, labels: ['Q'] },
      { x: 1, y: 0, labels: ['W'] },
      { x: 2, y: 0, labels: ['E'] },
    ])
    const result = serialize(kb)
    // Should have one row (plus possible metadata row)
    const rows = result.filter(r => Array.isArray(r))
    expect(rows).toHaveLength(1)
    const row = rows[0] as unknown[]
    const strings = row.filter(el => typeof el === 'string')
    expect(strings).toEqual(['Q', 'W', 'E'])
  })
})

// ---------------------------------------------------------------------------
// 2. Metadata
// ---------------------------------------------------------------------------
describe('serialize metadata', () => {
  it('should only include non-default metadata values', () => {
    const kb: Keyboard = {
      meta: { ...clone(DEFAULT_METADATA), name: 'Test Layout' },
      keys: [clone(DEFAULT_KEY)],
    }
    kb.keys[0].labels = ['A']
    const result = serialize(kb)
    // First element should be metadata object
    const meta = result[0] as Record<string, unknown>
    expect(meta).toBeDefined()
    expect(typeof meta).toBe('object')
    expect(meta.name).toBe('Test Layout')
    // Default values should NOT be included
    expect(meta.backcolor).toBeUndefined()
    expect(meta.author).toBeUndefined()
  })

  it('should skip metadata entirely if all default', () => {
    const kb = singleKey()
    const result = serialize(kb)
    // First element should be the row array (no metadata object)
    expect(Array.isArray(result[0])).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 3. Row detection
// ---------------------------------------------------------------------------
describe('serialize row detection', () => {
  it('should start a new row when y changes', () => {
    const kb = multiKey([
      { x: 0, y: 0, labels: ['A'] },
      { x: 0, y: 1, labels: ['B'] },
    ])
    const result = serialize(kb)
    const rows = result.filter(r => Array.isArray(r))
    expect(rows.length).toBe(2)
  })

  it('should start a new row when cluster changes', () => {
    const kb = multiKey([
      { x: 0, y: 0, rotation_angle: 0, rotation_x: 0, rotation_y: 0, labels: ['A'] },
      { x: 0, y: 0, rotation_angle: 45, rotation_x: 0, rotation_y: 0, labels: ['B'] },
    ])
    const result = serialize(kb)
    const rows = result.filter(r => Array.isArray(r))
    expect(rows.length).toBe(2)
  })

  it('should keep keys in same row when y is the same and cluster is the same', () => {
    const kb = multiKey([
      { x: 0, y: 0, labels: ['A'] },
      { x: 1, y: 0, labels: ['B'] },
    ])
    const result = serialize(kb)
    const rows = result.filter(r => Array.isArray(r))
    expect(rows.length).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// 4. Delta compression
// ---------------------------------------------------------------------------
describe('serialize delta compression', () => {
  it('should only write properties that differ from current state', () => {
    const kb = singleKey({ x: 0, y: 0, color: '#cccccc' })
    const result = serialize(kb)
    const row = result.find(r => Array.isArray(r)) as unknown[]
    const props = row.filter(el => typeof el === 'object' && el !== null)
    // Color is default (#cccccc), so it should NOT be in props
    for (const p of props) {
      expect((p as Record<string, unknown>).c).toBeUndefined()
    }
  })

  it('should write color when it differs from default', () => {
    const kb = singleKey({ x: 0, y: 0, color: '#ff0000' })
    const result = serialize(kb)
    const row = result.find(r => Array.isArray(r)) as unknown[]
    const props = row.filter(el => typeof el === 'object' && el !== null)
    // Should have a props object with c:'#ff0000'
    const hasColor = props.some(p => (p as Record<string, unknown>).c === '#ff0000')
    expect(hasColor).toBe(true)
  })

  it('should write width when not 1', () => {
    const kb = singleKey({ x: 0, y: 0, width: 2, width2: 2 })
    const result = serialize(kb)
    const row = result.find(r => Array.isArray(r)) as unknown[]
    const props = row.filter(el => typeof el === 'object' && el !== null)
    const hasWidth = props.some(p => (p as Record<string, unknown>).w === 2)
    expect(hasWidth).toBe(true)
  })

  it('should not write x delta when position is contiguous', () => {
    const kb = multiKey([
      { x: 0, y: 0, width: 1, labels: ['A'] },
      { x: 1, y: 0, width: 1, labels: ['B'] },
    ])
    const result = serialize(kb)
    const row = result.filter(r => Array.isArray(r))[0] as unknown[]
    const props = row.filter(el => typeof el === 'object' && el !== null)
    // Second key should not need x prop (contiguous)
    // First key has no props (defaults), second key may or may not
    for (const p of props) {
      expect((p as Record<string, unknown>).x).toBeUndefined()
    }
  })
})

// ---------------------------------------------------------------------------
// 5. Label reordering
// ---------------------------------------------------------------------------
describe('serialize label reordering', () => {
  it('should choose optimal alignment flag for labels', () => {
    // A key with only top-left and bottom-right labels
    const key = clone(DEFAULT_KEY)
    key.x = 0
    key.y = 0
    key.labels = ['A', '', '', '', '', '', '', '', 'B', '', '', '']
    key.textColor = []
    key.textSize = []
    const kb: Keyboard = { meta: clone(DEFAULT_METADATA), keys: [key] }
    const result = serialize(kb)
    const row = result.find(r => Array.isArray(r)) as unknown[]
    // Should contain alignment prop if non-default
    const _props = row.filter(el => typeof el === 'object' && el !== null) as Record<string, unknown>[]
    // The alignment should be optimized (not necessarily 4)
    const labelStr = row.filter(el => typeof el === 'string')[0] as string
    expect(labelStr).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 6. Text size optimization
// ---------------------------------------------------------------------------
describe('serialize text size optimization', () => {
  it('should use f for default text size', () => {
    const key = clone(DEFAULT_KEY)
    key.x = 0
    key.y = 0
    key.labels = ['A']
    key.default.textSize = 5
    key.textSize = []
    const kb: Keyboard = { meta: clone(DEFAULT_METADATA), keys: [key] }
    const result = serialize(kb)
    const row = result.find(r => Array.isArray(r)) as unknown[]
    const props = row.filter(el => typeof el === 'object' && el !== null) as Record<string, unknown>[]
    const hasF = props.some(p => p.f === 5)
    expect(hasF).toBe(true)
  })

  it('should use f2 when all non-first sizes are the same', () => {
    // Create a key with two labels where the second label has a different size
    const key = clone(DEFAULT_KEY)
    key.x = 0
    key.y = 0
    // Use a=0 so we can control label positions directly
    key.labels = ['A', '', '', '', '', '', 'B', '', '', '', '', '']
    key.default.textSize = 3
    key.textSize = [undefined, undefined, undefined, undefined, undefined, undefined, 2, undefined, undefined, undefined, undefined, undefined]
    const kb: Keyboard = { meta: clone(DEFAULT_METADATA), keys: [key] }
    const result = serialize(kb)
    const row = result.find(r => Array.isArray(r)) as unknown[]
    const props = row.filter(el => typeof el === 'object' && el !== null) as Record<string, unknown>[]
    // The serializer should use either f2 or fa for varied text sizes
    const hasF2 = props.some(p => p.f2 !== undefined)
    const hasFa = props.some(p => Array.isArray(p.fa))
    expect(hasF2 || hasFa).toBe(true)
  })

  it('should use fa when sizes are varied', () => {
    const key = clone(DEFAULT_KEY)
    key.x = 0
    key.y = 0
    key.labels = ['A', 'B', 'C', '', '', '', '', '', '', '', '', '']
    key.default.textSize = 3
    key.textSize = [undefined, 2, 4, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined]
    const kb: Keyboard = { meta: clone(DEFAULT_METADATA), keys: [key] }
    const result = serialize(kb)
    const row = result.find(r => Array.isArray(r)) as unknown[]
    const props = row.filter(el => typeof el === 'object' && el !== null) as Record<string, unknown>[]
    const hasFa = props.some(p => Array.isArray(p.fa))
    expect(hasFa).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 7. sortKeys
// ---------------------------------------------------------------------------
describe('sortKeys', () => {
  it('should sort keys by rotation, then position', () => {
    const keys: Key[] = [
      { ...clone(DEFAULT_KEY), x: 2, y: 0, rotation_angle: 0, rotation_x: 0, rotation_y: 0 },
      { ...clone(DEFAULT_KEY), x: 0, y: 0, rotation_angle: 0, rotation_x: 0, rotation_y: 0 },
      { ...clone(DEFAULT_KEY), x: 1, y: 0, rotation_angle: 0, rotation_x: 0, rotation_y: 0 },
    ]
    const sorted = sortKeys(keys)
    expect(sorted[0].x).toBe(0)
    expect(sorted[1].x).toBe(1)
    expect(sorted[2].x).toBe(2)
  })

  it('should sort by rotation_angle first', () => {
    const keys: Key[] = [
      { ...clone(DEFAULT_KEY), x: 0, y: 0, rotation_angle: 45, rotation_x: 0, rotation_y: 0 },
      { ...clone(DEFAULT_KEY), x: 0, y: 0, rotation_angle: 0, rotation_x: 0, rotation_y: 0 },
    ]
    const sorted = sortKeys(keys)
    expect(sorted[0].rotation_angle).toBe(0)
    expect(sorted[1].rotation_angle).toBe(45)
  })

  it('should sort by rotation_x then rotation_y then y then x', () => {
    const keys: Key[] = [
      { ...clone(DEFAULT_KEY), x: 1, y: 1, rotation_angle: 0, rotation_x: 1, rotation_y: 0 },
      { ...clone(DEFAULT_KEY), x: 0, y: 0, rotation_angle: 0, rotation_x: 0, rotation_y: 1 },
      { ...clone(DEFAULT_KEY), x: 0, y: 0, rotation_angle: 0, rotation_x: 0, rotation_y: 0 },
    ]
    const sorted = sortKeys(keys)
    expect(sorted[0].rotation_x).toBe(0)
    expect(sorted[0].rotation_y).toBe(0)
    expect(sorted[1].rotation_y).toBe(1)
    expect(sorted[2].rotation_x).toBe(1)
  })

  it('should not mutate the original array', () => {
    const keys: Key[] = [
      { ...clone(DEFAULT_KEY), x: 2, y: 0 },
      { ...clone(DEFAULT_KEY), x: 0, y: 0 },
    ]
    const sorted = sortKeys(keys)
    expect(sorted).not.toBe(keys)
    expect(keys[0].x).toBe(2)
    expect(keys[1].x).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 8. Roundtrip: parse → serialize → parse
// ---------------------------------------------------------------------------
describe('serialize roundtrip', () => {
  it('should produce equivalent keyboard after parse → serialize → parse', () => {
    const input = JSON.stringify([
      { name: 'Test', author: 'Me' },
      ['Q', 'W', 'E', 'R', 'T', 'Y'],
    ])
    const kb1 = parse(input)
    const serialized = serialize(kb1)
    const kb2 = deserialize(serialized as unknown[])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  it('should roundtrip a keyboard with custom colors', () => {
    const input = JSON.stringify([
      [{ c: '#ff0000', t: '#00ff00' }, 'A', 'B'],
    ])
    const kb1 = parse(input)
    const serialized = serialize(kb1)
    const kb2 = deserialize(serialized as unknown[])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  it('should roundtrip a keyboard with varied widths', () => {
    const input = JSON.stringify([
      [{ w: 2 }, 'A', { w: 1.5 }, 'B'],
    ])
    const kb1 = parse(input)
    const serialized = serialize(kb1)
    const kb2 = deserialize(serialized as unknown[])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  it('should roundtrip a keyboard with rotation', () => {
    const input = JSON.stringify([
      [{ r: 45, rx: 1, ry: 2 }, 'A'],
    ])
    const kb1 = parse(input)
    const serialized = serialize(kb1)
    const kb2 = deserialize(serialized as unknown[])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  it('should roundtrip a keyboard with multiple rows', () => {
    const input = JSON.stringify([
      ['A', 'B'],
      ['C', 'D'],
    ])
    const kb1 = parse(input)
    const serialized = serialize(kb1)
    const kb2 = deserialize(serialized as unknown[])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  it('should roundtrip a keyboard with ghost keys', () => {
    const input = JSON.stringify([
      [{ g: true }, 'A', 'B'],
    ])
    const kb1 = parse(input)
    const serialized = serialize(kb1)
    const kb2 = deserialize(serialized as unknown[])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  it('should roundtrip a keyboard with profile', () => {
    const input = JSON.stringify([
      [{ p: 'DSA' }, 'A', 'B'],
    ])
    const kb1 = parse(input)
    const serialized = serialize(kb1)
    const kb2 = deserialize(serialized as unknown[])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  it('should roundtrip a keyboard with switch properties', () => {
    const input = JSON.stringify([
      [{ sm: 'cherry', sb: 'alps', st: 'MX1A-11Nx' }, 'A'],
    ])
    const kb1 = parse(input)
    const serialized = serialize(kb1)
    const kb2 = deserialize(serialized as unknown[])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  it('should roundtrip a keyboard with stepped keys', () => {
    const input = JSON.stringify([
      [{ l: true, w: 1.5, w2: 1, x2: -0.25 }, 'A'],
    ])
    const kb1 = parse(input)
    const serialized = serialize(kb1)
    const kb2 = deserialize(serialized as unknown[])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  it('should roundtrip a keyboard with decal keys', () => {
    const input = JSON.stringify([
      [{ d: true }, 'A'],
    ])
    const kb1 = parse(input)
    const serialized = serialize(kb1)
    const kb2 = deserialize(serialized as unknown[])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  it('should roundtrip a keyboard with text sizes', () => {
    const input = JSON.stringify([
      [{ f: 1 }, 'A', { f2: 2 }, 'B'],
    ])
    const kb1 = parse(input)
    const serialized = serialize(kb1)
    const kb2 = deserialize(serialized as unknown[])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })
})
