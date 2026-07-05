import type { Key } from '../src/index'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { deserialize, serialize, sortKeys } from '../src/index'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturesDir = resolve(__dirname, 'fixtures')

const NUMERIC_PROPS: (keyof Key)[] = [
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
]

const EXACT_PROPS: (keyof Key)[] = [
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

function approxEqual(a: number, b: number): boolean {
  return Math.round(a * 10000) === Math.round(b * 10000)
}

function keysEqual(a: Key[], b: Key[]): boolean {
  if (a.length !== b.length)
    return false
  for (let i = 0; i < a.length; i++) {
    const ka = a[i]
    const kb = b[i]
    for (const p of NUMERIC_PROPS) {
      if (!approxEqual(ka[p] as number, kb[p] as number))
        return false
    }
    for (const p of EXACT_PROPS) {
      if (ka[p] !== kb[p])
        return false
    }
    if (ka.default.textColor !== kb.default.textColor)
      return false
    if (ka.default.textSize !== kb.default.textSize)
      return false
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

// ---------------------------------------------------------------------------
// Discover fixture pairs
// ---------------------------------------------------------------------------

const slugs = readdirSync(fixturesDir)
  .filter((f: string) => f.endsWith('.input.json'))
  .map((f: string) => f.replace('.input.json', ''))
  .sort()

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parse', () => {
  for (const slug of slugs) {
    const input: unknown[] = JSON.parse(
      readFileSync(resolve(fixturesDir, `${slug}.input.json`), 'utf-8'),
    )
    const expected: Key[] = JSON.parse(
      readFileSync(resolve(fixturesDir, `${slug}.output.json`), 'utf-8'),
    )

    describe(slug, () => {
      it('matches reference output', () => {
        const result = deserialize(input)
        expect(result.keys.length).toBe(expected.length)

        for (let i = 0; i < expected.length; i++) {
          const actual = result.keys[i]
          const exp = expected[i]

          for (const p of NUMERIC_PROPS) {
            expect(
              approxEqual(actual[p] as number, exp[p] as number),
              `key[${i}].${p}: ${actual[p]} vs ${exp[p]}`,
            ).toBe(true)
          }

          for (const p of EXACT_PROPS) {
            expect(actual[p], `key[${i}].${p}`).toBe(exp[p])
          }

          expect(actual.default.textColor, `key[${i}].default.textColor`).toBe(exp.default.textColor)
          expect(actual.default.textSize, `key[${i}].default.textSize`).toBe(exp.default.textSize)

          for (let j = 0; j < 12; j++) {
            expect(actual.labels[j] ?? '', `key[${i}].labels[${j}]`).toBe(exp.labels[j] ?? '')
            expect(actual.textColor[j] ?? undefined, `key[${i}].textColor[${j}]`).toBe(exp.textColor[j] ?? undefined)
            expect(actual.textSize[j] ?? undefined, `key[${i}].textSize[${j}]`).toBe(exp.textSize[j] ?? undefined)
          }
        }
      })

      it('roundtrips', () => {
        const kb1 = deserialize(input)
        const serialized = serialize(kb1)
        const kb2 = deserialize(serialized as unknown[])
        expect(keysEqual(sortKeys(kb1.keys), sortKeys(kb2.keys))).toBe(true)
      })
    })
  }
})
