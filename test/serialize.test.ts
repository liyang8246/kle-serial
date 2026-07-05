import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { deserialize, serialize } from '../src/index'
import { fixturesDir, slugs } from './helpers'

describe('serialize', () => {
  for (const slug of slugs) {
    const input: unknown[] = JSON.parse(
      readFileSync(resolve(fixturesDir, `${slug}.input.json`), 'utf-8'),
    )

    describe(slug, () => {
      it('produces valid KLE array', () => {
        const kb = deserialize(input)
        const result = serialize(kb)
        expect(Array.isArray(result)).toBe(true)
        // First element is either metadata object or a row array;
        // empty keyboards produce an empty array
        if (result.length > 0) {
          const first = result[0]
          expect(first != null).toBe(true)
        }
      })
    })
  }
})
