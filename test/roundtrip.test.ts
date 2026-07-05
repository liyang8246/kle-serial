import type { Key } from '../src/index'
import { describe, expect, it } from 'vitest'
import { deserialize, parse, serialize } from '../src/index'

/**
 * Deep-compare two Key arrays for structural equality.
 * - `undefined` and missing array entries are treated as equivalent
 * - Empty strings `""` and undefined are treated as equivalent for labels/textColor/textSize
 */
function keysEqual(a: Key[], b: Key[]): boolean {
  if (a.length !== b.length)
    return false
  for (let i = 0; i < a.length; i++) {
    const ka = a[i]
    const kb = b[i]
    // Scalar properties
    const scalars: (keyof Key)[] = [
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
    for (const p of scalars) {
      if (ka[p] !== kb[p])
        return false
    }
    // default
    if (ka.default.textColor !== kb.default.textColor)
      return false
    if (ka.default.textSize !== kb.default.textSize)
      return false
    // labels, textColor, textSize — compare up to index 11
    for (let j = 0; j < 12; j++) {
      if ((ka.labels[j] ?? '') !== (kb.labels[j] ?? ''))
        return false
      if ((ka.textColor[j] ?? undefined) !== (kb.textColor[j] ?? undefined))
        return false
      if ((ka.textSize[j] ?? undefined) !== (kb.textSize[j] ?? undefined))
        return false
    }
  }
  return true
}

function metaEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of allKeys) {
    if ((a[k] ?? undefined) !== (b[k] ?? undefined))
      return false
  }
  return true
}

/**
 * Core roundtrip check: deserialize(serialize(deserialize(input))) === deserialize(input)
 */
function roundtrip(raw: unknown[]): { kb1: ReturnType<typeof deserialize>, kb2: ReturnType<typeof deserialize> } {
  const kb1 = deserialize(raw)
  const serialized = serialize(kb1)
  const kb2 = deserialize(serialized as unknown[])
  return { kb1, kb2 }
}

// ===========================================================================
// Roundtrip tests
// ===========================================================================
describe('roundtrip', () => {
  // -------------------------------------------------------------------------
  // Simple keyboards
  // -------------------------------------------------------------------------
  it('should roundtrip an empty keyboard', () => {
    const kb1 = deserialize([])
    const serialized = serialize(kb1)
    const kb2 = deserialize(serialized as unknown[])
    expect(kb2.keys).toHaveLength(0)
  })

  it('should roundtrip a single key', () => {
    const { kb1, kb2 } = roundtrip([['A']])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  it('should roundtrip a simple QWERTY row', () => {
    const { kb1, kb2 } = roundtrip([['Q', 'W', 'E', 'R', 'T', 'Y']])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  it('should roundtrip multiple rows', () => {
    const { kb1, kb2 } = roundtrip([
      ['Q', 'W', 'E', 'R', 'T', 'Y'],
      ['A', 'S', 'D', 'F', 'G', 'H'],
      ['Z', 'X', 'C', 'V', 'B', 'N'],
    ])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  // -------------------------------------------------------------------------
  // Metadata
  // -------------------------------------------------------------------------
  it('should roundtrip metadata', () => {
    const { kb1, kb2 } = roundtrip([{ name: 'Test Layout', author: 'Author' }])
    expect(metaEqual(kb1.meta as Record<string, unknown>, kb2.meta as Record<string, unknown>)).toBe(true)
  })

  it('should roundtrip custom backcolor', () => {
    const { kb1, kb2 } = roundtrip([{ backcolor: '#aabbcc' }, ['A']])
    expect(kb2.meta.backcolor).toBe('#aabbcc')
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  // -------------------------------------------------------------------------
  // Key sizes
  // -------------------------------------------------------------------------
  it('should roundtrip keys with varied widths', () => {
    const { kb1, kb2 } = roundtrip([[{ w: 2 }, 'A', { w: 1.5 }, 'B', 'C']])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  it('should roundtrip keys with varied heights', () => {
    const { kb1, kb2 } = roundtrip([[{ h: 2 }, 'A', { h: 1.5 }, 'B']])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  it('should roundtrip keys with w2/h2 (ISO enter style)', () => {
    const { kb1, kb2 } = roundtrip([[{ w: 1.25, h: 2, w2: 1.5, h2: 1, x2: -0.25, y2: 0.25 }, 'Enter']])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  // -------------------------------------------------------------------------
  // Colors
  // -------------------------------------------------------------------------
  it('should roundtrip key colors', () => {
    const { kb1, kb2 } = roundtrip([[{ c: '#ff0000' }, 'A', { c: '#0000ff' }, 'B']])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  it('should roundtrip text colors', () => {
    const { kb1, kb2 } = roundtrip([[{ t: '#00ff00' }, 'A']])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  it('should roundtrip multi-color text', () => {
    const labels = '#111111\n#222222\n#333333\n#444444\n#555555\n#666666\n#777777\n#888888\n#999999\n#aaaaaa\n#bbbbbb\n#cccccc'
    const { kb1, kb2 } = roundtrip([[{ a: 0, t: labels }, labels]])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  // -------------------------------------------------------------------------
  // Rotation
  // -------------------------------------------------------------------------
  it('should roundtrip rotation', () => {
    const { kb1, kb2 } = roundtrip([[{ r: 45, rx: 1, ry: 2 }, 'A']])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  it('should roundtrip multiple rotation clusters', () => {
    const { kb1, kb2 } = roundtrip([
      [{ r: 30, rx: 0, ry: 0 }, 'A'],
      [{ r: 60, rx: 5, ry: 0 }, 'B'],
    ])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  // -------------------------------------------------------------------------
  // Flags
  // -------------------------------------------------------------------------
  it('should roundtrip ghost keys', () => {
    const { kb1, kb2 } = roundtrip([[{ g: true }, 'A', 'B']])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  it('should roundtrip ghost off', () => {
    const { kb1, kb2 } = roundtrip([[{ g: true }, 'A', { g: false }, 'B']])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  it('should roundtrip nub (homing) keys', () => {
    const { kb1, kb2 } = roundtrip([[{ n: true }, 'A']])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  it('should roundtrip stepped keys', () => {
    const { kb1, kb2 } = roundtrip([[{ l: true, w: 1.5, w2: 1, x2: -0.25 }, 'A']])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  it('should roundtrip decal keys', () => {
    const { kb1, kb2 } = roundtrip([[{ d: true }, 'A']])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  // -------------------------------------------------------------------------
  // Profile and switch properties
  // -------------------------------------------------------------------------
  it('should roundtrip profile', () => {
    const { kb1, kb2 } = roundtrip([[{ p: 'DSA' }, 'A', 'B']])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  it('should roundtrip switch properties', () => {
    const { kb1, kb2 } = roundtrip([[{ sm: 'cherry', sb: 'alps', st: 'MX1A-11Nx' }, 'A']])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  // -------------------------------------------------------------------------
  // Text sizes
  // -------------------------------------------------------------------------
  it('should roundtrip default text size (f)', () => {
    const { kb1, kb2 } = roundtrip([[{ f: 1 }, 'A']])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  it('should roundtrip f2 text sizes', () => {
    const { kb1, kb2 } = roundtrip([[{ f: 1, f2: 2 }, 'A\nB']])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  it('should roundtrip fa text sizes', () => {
    const { kb1, kb2 } = roundtrip([
      [{ f: 1, fa: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] }, 'A\nB\nC\nD\nE\nF\nG\nH\nI\nJ\nK\nL'],
    ])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  // -------------------------------------------------------------------------
  // Legends with alignment
  // -------------------------------------------------------------------------
  it('should roundtrip legends with alignment flag a=0', () => {
    const { kb1, kb2 } = roundtrip([[{ a: 0 }, '0\n1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11']])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  it('should roundtrip legends with alignment flag a=4 (default)', () => {
    const { kb1, kb2 } = roundtrip([['A\nB\nC']])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  // -------------------------------------------------------------------------
  // Complex keyboard
  // -------------------------------------------------------------------------
  it('should roundtrip a complex keyboard', () => {
    const raw = [
      { name: 'Complex Test', author: 'Test', backcolor: '#222222' },
      [
        { c: '#ff0000', t: '#ffffff', w: 2 },
        'Esc',
        { x: 0.5 },
        'F1',
        'F2',
        'F3',
        'F4',
        { x: 0.5 },
        'F5',
        'F6',
        'F7',
        'F8',
      ],
      [
        { w: 1.5 },
        'Tab',
        'Q',
        'W',
        { n: true },
        'F',
        'R',
        'T',
        'Y',
        { w: 1.5 },
        'Enter',
      ],
      [
        { w: 1.75 },
        'Caps',
        'A',
        'S',
        { p: 'DSA' },
        'D',
        'F',
        'G',
        'H',
        { w: 2.25 },
        'Shift',
      ],
      [
        { w: 1.25 },
        'Ctrl',
        'Win',
        'Alt',
        { w: 6.25 },
        'Space',
        { w: 1.25 },
        'Alt',
        'Menu',
        'Ctrl',
      ],
    ]
    const { kb1, kb2 } = roundtrip(raw)
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
    expect(metaEqual(kb1.meta as Record<string, unknown>, kb2.meta as Record<string, unknown>)).toBe(true)
  })

  // -------------------------------------------------------------------------
  // Position offsets
  // -------------------------------------------------------------------------
  it('should roundtrip x/y offsets', () => {
    const { kb1, kb2 } = roundtrip([[{ x: 3, y: 2 }, 'A', 'B']])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  // -------------------------------------------------------------------------
  // parse → serialize → deserialize roundtrip
  // -------------------------------------------------------------------------
  it('should roundtrip through parse()', () => {
    const json = JSON.stringify([
      { name: 'Parse Test' },
      [{ c: '#ff0000' }, 'A', 'B'],
      ['C', 'D'],
    ])
    const kb1 = parse(json)
    const serialized = serialize(kb1)
    const kb2 = deserialize(serialized as unknown[])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  it('should roundtrip JSON5 input through parse()', () => {
    const json5 = `[
      { name: "JSON5 Test" },
      ["A", "B", "C"]
    ]`
    const kb1 = parse(json5)
    const serialized = serialize(kb1)
    const kb2 = deserialize(serialized as unknown[])
    expect(keysEqual(kb1.keys, kb2.keys)).toBe(true)
  })

  // -------------------------------------------------------------------------
  // Double roundtrip stability
  // -------------------------------------------------------------------------
  it('should be stable across multiple roundtrips', () => {
    const raw = [
      { name: 'Stability' },
      [{ w: 2, c: '#ff0000', t: '#00ff00' }, 'A', { w: 1.5 }, 'B'],
      [{ y: 0.5, p: 'DSA' }, 'C', 'D'],
    ]
    const kb1 = deserialize(raw)
    const s1 = serialize(kb1)
    const kb2 = deserialize(s1 as unknown[])
    const s2 = serialize(kb2)
    const kb3 = deserialize(s2 as unknown[])
    // Second and third parse should be identical
    expect(keysEqual(kb2.keys, kb3.keys)).toBe(true)
    // Serialized forms should be identical (stable)
    expect(JSON.stringify(s1)).toBe(JSON.stringify(s2))
  })
})
