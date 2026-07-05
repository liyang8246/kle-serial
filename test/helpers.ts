import type { Key } from '../src/index'
import { readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const __dirname = dirname(fileURLToPath(import.meta.url))
export const fixturesDir = resolve(__dirname, 'fixtures')

export const NUMERIC_PROPS: (keyof Key)[] = [
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

export const EXACT_PROPS: (keyof Key)[] = [
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

export function approxEqual(a: number, b: number): boolean {
  return Math.round(a * 10000) === Math.round(b * 10000)
}

export function keysEqual(a: Key[], b: Key[]): boolean {
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

export const slugs = readdirSync(fixturesDir)
  .filter((f: string) => f.endsWith('.input.json'))
  .map((f: string) => f.replace('.input.json', ''))
  .sort()

export const compactSlugs = readdirSync(fixturesDir)
  .filter((f: string) => f.endsWith('.compact.json'))
  .map((f: string) => f.replace('.compact.json', ''))
  .sort()
