import type { CompactKeyboard } from '../src/index'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CompactKeyboardSchema, deserialize, deserializeCompact, parseCompact, serializeCompact, sortKeys } from '../src/index'
import { compactSlugs, fixturesDir, keysEqual } from './helpers'

describe('serializeCompact', () => {
  for (const slug of compactSlugs) {
    const compactFixture: CompactKeyboard = JSON.parse(
      readFileSync(resolve(fixturesDir, `${slug}.compact.json`), 'utf-8'),
    )
    const input: unknown[] = JSON.parse(
      readFileSync(resolve(fixturesDir, `${slug}.input.json`), 'utf-8'),
    )

    describe(slug, () => {
      it('matches compact fixture', () => {
        const kb = deserialize(input)
        const compact = serializeCompact(kb)
        expect(compact).toEqual(compactFixture)
      })

      it('roundtrips via deserializeCompact', () => {
        const kb1 = deserialize(input)
        const compact = serializeCompact(kb1)
        const kb2 = deserializeCompact(compact)
        expect(keysEqual(sortKeys(kb1.keys), sortKeys(kb2.keys))).toBe(true)
      })

      it('output validates against CompactKeyboardSchema', () => {
        const kb = deserialize(input)
        const compact = serializeCompact(kb)
        const result = CompactKeyboardSchema.safeParse(compact)
        expect(result.success).toBe(true)
      })
    })
  }

  it('strips metadata row from keyboard with non-default metadata', () => {
    const input: unknown[] = [{ backcolor: '#cccccc', name: 'Test' }, ['A', 'B']]
    const kb = deserialize(input)
    const compact = serializeCompact(kb)
    // Compact should have no metadata — only key rows
    for (const row of compact) {
      expect(Array.isArray(row)).toBe(true)
    }
    expect(compact.length).toBe(1)
  })

  it('returns empty array for keyboard with no keys and default metadata', () => {
    const kb = deserialize([[]])
    const compact = serializeCompact(kb)
    // No keys and default-only metadata → empty compact output
    expect(compact).toEqual([])
  })
})

describe('deserializeCompact', () => {
  it('parses compact format with default metadata', () => {
    const compact = [[{ w: 1.5 }, 'Tab', 'Q', 'W']]
    const kb = deserializeCompact(compact)
    expect(kb.keys.length).toBe(3)
    expect(kb.keys[0].width).toBe(1.5)
    expect(kb.keys[0].labels[0]).toBe('Tab')
    expect(kb.keys[1].labels[0]).toBe('Q')
    // Metadata should be defaults
    expect(kb.meta.backcolor).toBe('#eeeeee')
  })

  it('roundtrips compact format (metadata lost)', () => {
    const input: unknown[] = [{ backcolor: '#cccccc', name: 'Test' }, ['A', 'B']]
    const kb1 = deserialize(input)
    const compact = serializeCompact(kb1)
    const kb2 = deserializeCompact(compact)
    // Keys should roundtrip
    expect(keysEqual(sortKeys(kb1.keys), sortKeys(kb2.keys))).toBe(true)
    // Metadata is lost in compact format (defaults filled in)
    expect(kb2.meta.backcolor).toBe('#eeeeee')
    expect(kb2.meta.name).toBe('')
  })

  it('rejects invalid compact input via Zod schema', () => {
    // Pass something that's not a valid compact format
    expect(() => deserializeCompact([{ backcolor: 'red' }, ['A']])).toThrow()
  })
})

describe('parseCompact', () => {
  it('parses JSON string of compact format', () => {
    const json = '[[{ "w": 1.5 }, "Tab", "Q", "W"]]'
    const kb = parseCompact(json)
    expect(kb.keys.length).toBe(3)
    expect(kb.keys[0].width).toBe(1.5)
  })

  it('parses JSON5 string with unquoted keys', () => {
    const json = '[[{w:1.5},"Tab","Q"]]'
    const kb = parseCompact(json)
    expect(kb.keys.length).toBe(2)
    expect(kb.keys[0].width).toBe(1.5)
  })
})
