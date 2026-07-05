import type { Key } from '../src/index'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { deserialize, serialize, sortKeys } from '../src/index'
import { approxEqual, EXACT_PROPS, fixturesDir, keysEqual, NUMERIC_PROPS, slugs } from './helpers'

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
