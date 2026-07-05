import type { Key, Keyboard, KeyboardMetadata } from './types'
import JSON5 from 'json5'
import { clone, createCurrentState, DEFAULT_METADATA, RawKeyPropsSchema, reorderLabelsIn } from './types'

export class KleParseError extends Error {
  constructor(message: string, public readonly data?: unknown) {
    super(`Error: ${message}${data ? `:\n  ${JSON.stringify(data)}` : ''}`)
    this.name = 'KleParseError'
  }
}

/** Deep merge source into target (matches reference `extend()` behavior). */
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const prop in source) {
    if (Object.hasOwn(source, prop)) {
      const srcVal = source[prop]
      if (srcVal != null && typeof srcVal === 'object' && !Array.isArray(srcVal)) {
        target[prop] ??= {}
        deepMerge(target[prop] as Record<string, unknown>, srcVal as Record<string, unknown>)
      }
      else {
        target[prop] = srcVal
      }
    }
  }
}

export function deserialize(rows: unknown[]): Keyboard {
  if (!Array.isArray(rows))
    throw new KleParseError('expected an array')
  const current = createCurrentState()
  const meta: KeyboardMetadata = clone(DEFAULT_METADATA)
  const keys: Key[] = []
  const cluster = { x: 0, y: 0 }
  let align = 4

  for (let r = 0; r < rows.length; ++r) {
    const row = rows[r]

    if (Array.isArray(row)) {
      for (let k = 0; k < row.length; ++k) {
        const el = row[k]

        if (typeof el === 'string') {
          const newKey: Key = clone(current)
          newKey.width2 = newKey.width2 === 0 ? current.width : newKey.width2
          newKey.height2 = newKey.height2 === 0 ? current.height : newKey.height2
          newKey.labels = reorderLabelsIn(el.split('\n'), align) as string[]
          newKey.textSize = reorderLabelsIn(newKey.textSize as (string | undefined)[], align) as (number | undefined)[]

          for (let i = 0; i < 12; ++i) {
            if (!newKey.labels[i]) {
              newKey.textSize[i] = undefined
              newKey.textColor[i] = undefined
            }
            if (newKey.textSize[i] === newKey.default.textSize)
              newKey.textSize[i] = undefined
            if (newKey.textColor[i] === newKey.default.textColor)
              newKey.textColor[i] = undefined
          }

          keys.push(newKey)

          current.x += current.width
          current.width = current.height = 1
          current.x2 = current.y2 = current.width2 = current.height2 = 0
          current.nub = current.stepped = current.decal = false
        }
        else if (el != null && typeof el === 'object') {
          const parsed = RawKeyPropsSchema.safeParse(el)
          if (!parsed.success)
            throw new KleParseError('invalid key properties', { errors: parsed.error, input: el })

          const key = parsed.data

          if (key.r != null) {
            if (k !== 0)
              throw new KleParseError('\'r\' can only be used on the first key in a row', key)
            current.rotation_angle = key.r
          }
          if (key.rx != null) {
            if (k !== 0)
              throw new KleParseError('\'rx\' can only be used on the first key in a row', key)
            current.rotation_x = cluster.x = key.rx
            current.x = cluster.x
            current.y = cluster.y
          }
          if (key.ry != null) {
            if (k !== 0)
              throw new KleParseError('\'ry\' can only be used on the first key in a row', key)
            current.rotation_y = cluster.y = key.ry
            current.x = cluster.x
            current.y = cluster.y
          }
          if (key.a != null) {
            align = key.a
          }
          if (key.f) {
            current.default.textSize = key.f
            current.textSize = []
          }
          if (key.f2) {
            for (let i = 1; i < 12; ++i) {
              current.textSize[i] = key.f2
            }
          }
          if (key.fa) {
            current.textSize = [...key.fa]
          }
          if (key.p) {
            current.profile = key.p
          }
          if (key.c) {
            current.color = key.c
          }
          if (key.t) {
            const split = key.t.split('\n')
            current.default.textColor = split[0]
            current.textColor = reorderLabelsIn(split, align)
          }
          if (key.x) {
            current.x += key.x
          }
          if (key.y) {
            current.y += key.y
          }
          if (key.w) {
            current.width = key.w
            current.width2 = key.w
          }
          if (key.h) {
            current.height = key.h
            current.height2 = key.h
          }
          if (key.x2) {
            current.x2 = key.x2
          }
          if (key.y2) {
            current.y2 = key.y2
          }
          if (key.w2) {
            current.width2 = key.w2
          }
          if (key.h2) {
            current.height2 = key.h2
          }
          if (key.n) {
            current.nub = key.n
          }
          if (key.l) {
            current.stepped = key.l
          }
          if (key.d) {
            current.decal = key.d
          }
          if (key.g != null) {
            current.ghost = key.g
          }
          if (key.sm) {
            current.sm = key.sm
          }
          if (key.sb) {
            current.sb = key.sb
          }
          if (key.st) {
            current.st = key.st
          }
        }
      }

      current.y++
    }
    else if (row != null && typeof row === 'object') {
      if (r !== 0)
        throw new KleParseError('keyboard metadata must be the first element', row)
      deepMerge(meta as Record<string, unknown>, row as Record<string, unknown>)
    }

    current.x = current.rotation_x
  }

  return { meta, keys }
}

export function parse(json: string): Keyboard {
  const result = JSON5.parse(json)
  return deserialize(result)
}
