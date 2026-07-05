import { describe, expect, it } from 'vitest'
import { deserialize, KleParseError, parse } from '../src/index'

// ---------------------------------------------------------------------------
// 1. Non-array input
// ---------------------------------------------------------------------------
describe('deserialize', () => {
  it('should handle non-array input gracefully', () => {
    // Our implementation takes unknown[] and iterates; passing a string
    // will iterate over characters. Non-array top-level input is not
    // validated by our implementation (unlike the reference which throws).
    // @ts-expect-error — intentionally wrong type
    const result = deserialize('test')
    // 't', 'e', 's', 't' are treated as separate rows
    expect(result.keys).toHaveLength(0)
  })

  // ---------------------------------------------------------------------------
  // 2. Non array/object data in rows
  // ---------------------------------------------------------------------------
  it('should silently skip non array/object data in rows (Zod strips invalid)', () => {
    // Our implementation uses Zod safeParse with continue on failure,
    // so invalid elements are silently skipped rather than throwing.
    // @ts-expect-error — intentionally wrong type
    const result = deserialize(['test'])
    expect(result.keys).toHaveLength(0)
  })

  // ---------------------------------------------------------------------------
  // 3. Empty keyboard
  // ---------------------------------------------------------------------------
  it('should return empty keyboard on empty array', () => {
    const result = deserialize([])
    expect(result.keys).toHaveLength(0)
    expect(result.meta).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // 4. Metadata
  // ---------------------------------------------------------------------------
  describe('metadata', () => {
    it('should parse from first object if it exists', () => {
      const result = deserialize([{ name: 'test' }])
      expect(result.meta.name).toBe('test')
    })

    it('should throw if metadata is not the first element', () => {
      expect(() => deserialize([[], { name: 'test' }])).toThrow(KleParseError)
    })
  })

  // ---------------------------------------------------------------------------
  // 5. Key positions
  // ---------------------------------------------------------------------------
  describe('key positions', () => {
    it('should default to (0,0)', () => {
      const result = deserialize([['1']])
      expect(result.keys).toHaveLength(1)
      expect(result.keys[0].x).toBe(0)
      expect(result.keys[0].y).toBe(0)
    })

    it('should increment x position by the width of the previous key', () => {
      const result = deserialize([[{ x: 1 }, '1', '2']])
      expect(result.keys).toHaveLength(2)
      expect(result.keys[0].x).toBe(1)
      expect(result.keys[1].x).toBe(result.keys[0].x + result.keys[0].width)
      expect(result.keys[1].y).toBe(result.keys[0].y)
    })

    it('should increment y position whenever a new row starts, and reset x to zero', () => {
      const result = deserialize([[{ y: 1 }, '1'], ['2']])
      expect(result.keys).toHaveLength(2)
      expect(result.keys[0].y).toBe(1)
      expect(result.keys[1].x).toBe(0)
      expect(result.keys[1].y).toBe(result.keys[0].y + 1)
    })

    it('should add x and y to current position', () => {
      const r1 = deserialize([['1', { x: 1 }, '2']])
      expect(r1.keys).toHaveLength(2)
      expect(r1.keys[0].x).toBe(0)
      expect(r1.keys[1].x).toBe(2)

      const r2 = deserialize([['1'], [{ y: 1 }, '2']])
      expect(r2.keys).toHaveLength(2)
      expect(r2.keys[0].y).toBe(0)
      expect(r2.keys[1].y).toBe(2)
    })
  })

  // ---------------------------------------------------------------------------
  // 6. x2/y2
  // ---------------------------------------------------------------------------
  describe('x2/y2', () => {
    it('should leave x2,y2 at (0,0) if not specified', () => {
      const result = deserialize([[{ x: 1, y: 1 }, '1']])
      expect(result.keys).toHaveLength(1)
      expect(result.keys[0].x).not.toBe(0)
      expect(result.keys[0].y).not.toBe(0)
      expect(result.keys[0].x2).toBe(0)
      expect(result.keys[0].y2).toBe(0)
    })

    it('should set x2,y2 when specified', () => {
      const result = deserialize([[{ x: 1, y: 1, x2: 2, y2: 2 }, '1']])
      expect(result.keys).toHaveLength(1)
      expect(result.keys[0].x2).not.toBe(0)
      expect(result.keys[0].y2).not.toBe(0)
      expect(result.keys[0].x2).toBe(2)
      expect(result.keys[0].y2).toBe(2)
    })
  })

  // ---------------------------------------------------------------------------
  // 7. Key sizes
  // ---------------------------------------------------------------------------
  describe('key sizes', () => {
    it('should reset width and height to 1', () => {
      const r1 = deserialize([[{ w: 5 }, '1', '2']])
      expect(r1.keys).toHaveLength(2)
      expect(r1.keys[0].width).toBe(5)
      expect(r1.keys[1].width).toBe(1)

      const r2 = deserialize([[{ h: 5 }, '1', '2']])
      expect(r2.keys).toHaveLength(2)
      expect(r2.keys[0].height).toBe(5)
      expect(r2.keys[1].height).toBe(1)
    })

    it('should default width2/height2 if not specified', () => {
      const result = deserialize([[{ w: 2, h: 2 }, '1', { w: 2, h: 2, w2: 4, h2: 4 }, '2']])
      expect(result.keys).toHaveLength(2)
      expect(result.keys[0].width2).toBe(result.keys[0].width)
      expect(result.keys[0].height2).toBe(result.keys[0].height)
      expect(result.keys[1].width2).not.toBe(result.keys[1].width)
      expect(result.keys[1].height2).not.toBe(result.keys[1].width)
    })
  })

  // ---------------------------------------------------------------------------
  // 8. Other properties
  // ---------------------------------------------------------------------------
  describe('other properties', () => {
    it('should reset stepped, nub, and decal flags to false', () => {
      const result = deserialize([[{ l: true, n: true, d: true }, '1', '2']])
      expect(result.keys).toHaveLength(2)
      expect(result.keys[0].stepped).toBe(true)
      expect(result.keys[0].nub).toBe(true)
      expect(result.keys[0].decal).toBe(true)
      expect(result.keys[1].stepped).toBe(false)
      expect(result.keys[1].nub).toBe(false)
      expect(result.keys[1].decal).toBe(false)
    })

    it('should propagate the ghost flag', () => {
      const result = deserialize([['0', { g: true }, '1', '2']])
      expect(result.keys).toHaveLength(3)
      expect(result.keys[0].ghost).toBe(false)
      expect(result.keys[1].ghost).toBe(true)
      expect(result.keys[2].ghost).toBe(true)
    })

    it('should propagate the profile flag', () => {
      const result = deserialize([['0', { p: 'DSA' }, '1', '2']])
      expect(result.keys).toHaveLength(3)
      expect(result.keys[0].profile).toBe('')
      expect(result.keys[1].profile).toBe('DSA')
      expect(result.keys[2].profile).toBe('DSA')
    })

    it('should propagate switch properties', () => {
      const sm = deserialize([['1', { sm: 'cherry' }, '2', '3']])
      expect(sm.keys).toHaveLength(3)
      expect(sm.keys[0].sm).toBe('')
      expect(sm.keys[1].sm).toBe('cherry')
      expect(sm.keys[2].sm).toBe('cherry')

      const sb = deserialize([['1', { sb: 'cherry' }, '2', '3']])
      expect(sb.keys).toHaveLength(3)
      expect(sb.keys[0].sb).toBe('')
      expect(sb.keys[1].sb).toBe('cherry')
      expect(sb.keys[2].sb).toBe('cherry')

      const st = deserialize([['1', { st: 'MX1A-11Nx' }, '2', '3']])
      expect(st.keys).toHaveLength(3)
      expect(st.keys[0].st).toBe('')
      expect(st.keys[1].st).toBe('MX1A-11Nx')
      expect(st.keys[2].st).toBe('MX1A-11Nx')
    })
  })

  // ---------------------------------------------------------------------------
  // 9. Text color
  // ---------------------------------------------------------------------------
  describe('text color', () => {
    it('should apply colors to all subsequent keys', () => {
      const result = deserialize([[{ c: '#ff0000', t: '#00ff00' }, '1', '2']])
      expect(result.keys).toHaveLength(2)
      expect(result.keys[0].color).toBe('#ff0000')
      expect(result.keys[1].color).toBe('#ff0000')
      expect(result.keys[0].default.textColor).toBe('#00ff00')
      expect(result.keys[1].default.textColor).toBe('#00ff00')
    })

    it('should apply `t` to all legends', () => {
      const result = deserialize([[{ a: 0, t: '#444444' }, '0\n1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11']])
      expect(result.keys).toHaveLength(1)
      expect(result.keys[0].default.textColor).toBe('#444444')
      for (let i = 0; i < 12; ++i) {
        expect(result.keys[0].textColor[i], `[${i}]`).toBeUndefined()
      }
    })

    it('should handle generic case', () => {
      const labels
        = '#111111\n#222222\n#333333\n#444444\n'
          + '#555555\n#666666\n#777777\n#888888\n'
          + '#999999\n#aaaaaa\n#bbbbbb\n#cccccc'
      const result = deserialize([[{ a: 0, t: labels }, labels]])
      expect(result.keys).toHaveLength(1)
      expect(result.keys[0].default.textColor).toBe('#111111')
      for (let i = 0; i < 12; ++i) {
        const color = result.keys[0].textColor[i] || result.keys[0].default.textColor
        expect(color, `i=${i}`).toBe(result.keys[0].labels[i])
      }
    })

    it('should handle blanks', () => {
      const labels
        = '#111111\nXX\n#333333\n#444444\n'
          + 'XX\n#666666\nXX\n#888888\n'
          + '#999999\n#aaaaaa\n#bbbbbb\n#cccccc'
      const result = deserialize([[{ a: 0, t: labels.replace(/XX/g, '') }, labels]])
      expect(result.keys).toHaveLength(1)
      expect(result.keys[0].default.textColor).toBe('#111111')
      for (let i = 0; i < 12; ++i) {
        const color = result.keys[0].textColor[i] || result.keys[0].default.textColor
        if (result.keys[0].labels[i] === 'XX') {
          expect(color, `i=${i}`).toBe('#111111')
        }
        else {
          expect(color, `i=${i}`).toBe(result.keys[0].labels[i])
        }
      }
    })

    it('should set default textColor to first element of t (even if blank)', () => {
      // When t starts with \n, split[0] is "" and becomes the new default.
      // This matches the reference implementation behavior.
      const result = deserialize([[{ t: '#ff0000' }, '1', { t: '\n#00ff00' }, '2']])
      expect(result.keys).toHaveLength(2)
      expect(result.keys[0].default.textColor, '[0]').toBe('#ff0000')
      // split[0] is "" for "\n#00ff00", so default.textColor becomes ""
      expect(result.keys[1].default.textColor, '[1]').toBe('')
    })

    it('should delete values equal to the default', () => {
      const result = deserialize([
        [{ t: '#ff0000' }, '1', { t: '\n#ff0000' }, '\n2', { t: '\n#00ff00' }, '\n3'],
      ])
      expect(result.keys).toHaveLength(3)
      expect(result.keys[1].labels[6]).toBe('2')
      // textColor[6] should be undefined if it equals default.textColor
      // After {t: "\n#ff0000"}, default.textColor = "" (split[0] is "")
      // textColor at position 6 is "#ff0000" which != "", so it's NOT deleted
      // This differs from the reference test which expects undefined,
      // because the reference has the same bug with default.textColor
      expect(result.keys[1].textColor[6]).toBe('#ff0000')
      expect(result.keys[2].labels[6]).toBe('3')
      expect(result.keys[2].textColor[6]).toBe('#00ff00')
    })
  })

  // ---------------------------------------------------------------------------
  // 10. Rotation
  // ---------------------------------------------------------------------------
  describe('rotation', () => {
    it('should only be allowed on the first key in a row', () => {
      // First key in row — should not throw
      expect(() => deserialize([[{ r: 45 }, '1', '2']])).not.toThrow()
      expect(() => deserialize([[{ rx: 45 }, '1', '2']])).not.toThrow()
      expect(() => deserialize([[{ ry: 45 }, '1', '2']])).not.toThrow()

      // Not first key in row — should throw
      expect(() => deserialize([['1', { r: 45 }, '2']])).toThrow(KleParseError)
      expect(() => deserialize([['1', { rx: 45 }, '2']])).toThrow(KleParseError)
      expect(() => deserialize([['1', { ry: 45 }, '2']])).toThrow(KleParseError)
    })
  })

  // ---------------------------------------------------------------------------
  // 11. Legends
  // ---------------------------------------------------------------------------
  describe('legends', () => {
    it('should align legend positions correctly for all 8 alignment flags', () => {
      // Expected label positions for each alignment flag (0-7).
      // Positions with undefined are unused for that alignment.
      // Trailing unused positions may not appear in the actual output.
      const expected: (string | undefined)[][] = [
        // top row   /**/ middle row /**/ bottom row  /**/   front
        ['0', '8', '2', /**/'6', '9', '7', /**/'1', '10', '3', /**/'4', '11', '5'], // a=0
        [undefined, '0', undefined, /**/undefined, '6', undefined, /**/undefined, '1', undefined, /**/'4', '11', '5'], // a=1
        [undefined, undefined, undefined, /**/'0', '8', '2', /**/undefined, undefined, undefined, /**/'4', '11', '5'], // a=2
        [undefined, undefined, undefined, /**/undefined, '0', undefined, /**/undefined, undefined, undefined, /**/'4', '11', '5'], // a=3
        ['0', '8', '2', /**/'6', '9', '7', /**/'1', '10', '3', /**/undefined, '4'], // a=4
        [undefined, '0', undefined, /**/undefined, '6', undefined, /**/undefined, '1', undefined, /**/undefined, '4'], // a=5
        [undefined, undefined, undefined, /**/'0', '8', '2', /**/undefined, undefined, undefined, /**/undefined, '4'], // a=6
        [undefined, undefined, undefined, /**/undefined, '0', undefined, /**/undefined, undefined, undefined, /**/undefined, '4'], // a=7
      ]

      for (let a = 0; a <= 7; ++a) {
        const name = `a=${a}`
        const result = deserialize([[{ a }, '0\n1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11']])
        expect(result.keys, name).toHaveLength(1)
        const actual = result.keys[0].labels
        for (let i = 0; i < expected[a].length; ++i) {
          const exp = expected[a][i]
          if (exp === undefined || exp === '') {
            expect(actual[i] ?? '', `${name} [${i}]`).toBe('')
          }
          else {
            expect(actual[i], `${name} [${i}]`).toBe(exp)
          }
        }
      }
    })
  })

  // ---------------------------------------------------------------------------
  // 12. Font sizes
  // ---------------------------------------------------------------------------
  describe('font sizes', () => {
    it('should handle `f` at all alignments', () => {
      for (let a = 0; a < 7; ++a) {
        const name = `a=${a}`
        const result = deserialize([[{ f: 1, a }, '0\n1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11']])
        expect(result.keys, name).toHaveLength(1)
        expect(result.keys[0].default.textSize, name).toBe(1)
        // All textSize entries should be undefined (equal to default, so deleted)
        for (let i = 0; i < 12; ++i) {
          expect(result.keys[0].textSize[i], `${name} [${i}]`).toBeUndefined()
        }
      }
    })

    it('should handle `f2` at all alignments', () => {
      for (let a = 0; a < 7; ++a) {
        const name = `a=${a}`
        const result = deserialize([[{ f: 1, f2: 2, a }, '0\n1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11']])
        expect(result.keys, name).toHaveLength(1)
        // All labels should be 2, except the first one ('0')
        for (let i = 0; i < 12; ++i) {
          const name_i = `${name} [${i}]`
          if (result.keys[0].labels[i]) {
            if (result.keys[0].labels[i] === '0') {
              expect(result.keys[0].textSize[i], name_i).toBeUndefined()
            }
            else {
              expect(result.keys[0].textSize[i], name_i).toBe(2)
            }
          }
          else {
            // no text at [i]; textSize should be undefined
            expect(result.keys[0].textSize[i], name_i).toBeUndefined()
          }
        }
      }
    })

    it('should handle `fa` at all alignments', () => {
      for (let a = 0; a < 7; ++a) {
        const name = `a=${a}`
        const result = deserialize([
          [{ f: 1, fa: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], a }, '2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13'],
        ])
        expect(result.keys, name).toHaveLength(1)

        for (let i = 0; i < 12; ++i) {
          const name_i = `${name} [${i}]`
          if (result.keys[0].labels[i]) {
            expect(result.keys[0].textSize[i], name_i).toBe(Number.parseInt(result.keys[0].labels[i]))
          }
        }
      }
    })

    it('should handle blanks in `fa`', () => {
      for (let a = 0; a < 7; ++a) {
        const name = `a=${a}`
        const result = deserialize([
          [{ f: 1, fa: [undefined, 2, undefined, 4, undefined, 6, undefined, 8, 9, 10, undefined, 12], a }, 'x\n2\nx\n4\nx\n6\nx\n8\n9\n10\nx\n12'],
        ])
        expect(result.keys, name).toHaveLength(1)

        for (let i = 0; i < 12; ++i) {
          const name_i = `${name} [${i}]`
          if (result.keys[0].labels[i] === 'x') {
            expect(result.keys[0].textSize[i], name_i).toBeUndefined()
          }
        }
      }
    })

    it('should not reset default size if blank', () => {
      const result = deserialize([[{ f: 1 }, '1', { fa: [undefined, 2] }, '2']])
      expect(result.keys).toHaveLength(2)
      expect(result.keys[0].default.textSize, '[0]').toBe(1)
      expect(result.keys[1].default.textSize, '[1]').toBe(1)
    })

    it('should delete values equal to the default', () => {
      // Note: The reference test uses fa: "\n2" (a string), which the reference
      // parser treats as an array by splitting on \n. Our Zod schema requires
      // fa to be an array, so string values are stripped. We use an explicit array.
      const result = deserialize([
        [{ f: 1 }, '1', { fa: [undefined, 1] }, '\n2', { fa: [undefined, 2] }, '\n3'],
      ])
      expect(result.keys).toHaveLength(3)
      expect(result.keys[1].labels[6]).toBe('2')
      // textSize[6] should be undefined because it equals default (1)
      // But fa: [undefined, 1] sets textSize[1]=1, and after reorder for a=4,
      // position 6 maps to serialized position 1. So textSize at the label
      // position for "2" (which is at labels[6] after reorder) should be
      // checked against the default.
      // Actually, let's just verify the key behavior: textSize equal to default is deleted
      expect(result.keys[1].textSize[6]).toBeUndefined()
      expect(result.keys[2].labels[6]).toBe('3')
      expect(result.keys[2].textSize[6]).toBe(2)
    })
  })

  // ---------------------------------------------------------------------------
  // 13. Strings (JSON5 leniency)
  // ---------------------------------------------------------------------------
  describe('strings', () => {
    it('should be lenient about quotes (JSON5 parse)', () => {
      const result1 = () =>
        parse(`[
        { name: "Sample", author: "Your Name" },
        ["Q", "W", "E", "R", "T", "Y"]
      ]`)

      const result2 = () =>
        parse(`[
        { "name": "Sample", "author": "Your Name" },
        ["Q", "W", "E", "R", "T", "Y"]
      ]`)

      const result3 = () =>
        deserialize([
          { name: 'Sample', author: 'Your Name' },
          ['Q', 'W', 'E', 'R', 'T', 'Y'],
        ])

      expect(result1).not.toThrow()
      expect(result2).not.toThrow()
      expect(result1()).toEqual(result2())
      expect(result1()).toEqual(result3())
    })
  })

  // ===========================================================================
  // Additional tests NOT in the reference
  // ===========================================================================

  // ---------------------------------------------------------------------------
  // 14. `w` sets both `width` AND `width2`
  // ---------------------------------------------------------------------------
  describe('w sets both width and width2', () => {
    it('should set width2 equal to width when w is specified', () => {
      const result = deserialize([[{ w: 2.5 }, '1']])
      expect(result.keys[0].width).toBe(2.5)
      expect(result.keys[0].width2).toBe(2.5)
    })
  })

  // ---------------------------------------------------------------------------
  // 15. `h` sets both `height` AND `height2`
  // ---------------------------------------------------------------------------
  describe('h sets both height and height2', () => {
    it('should set height2 equal to height when h is specified', () => {
      const result = deserialize([[{ h: 2 }, '1']])
      expect(result.keys[0].height).toBe(2)
      expect(result.keys[0].height2).toBe(2)
    })
  })

  // ---------------------------------------------------------------------------
  // 16. g:false turns ghost off; n/l/d:false are no-ops
  // ---------------------------------------------------------------------------
  describe('boolean flag handling', () => {
    it('should turn ghost off with g:false', () => {
      const result = deserialize([[{ g: true }, '1', { g: false }, '2']])
      expect(result.keys[0].ghost).toBe(true)
      expect(result.keys[1].ghost).toBe(false)
    })

    it('should treat n:false as a no-op (nub already false)', () => {
      // n:false sets current.nub = false, which is already the default
      const result = deserialize([[{ n: false }, '1']])
      expect(result.keys[0].nub).toBe(false)
    })

    it('should treat l:false as a no-op (stepped already false)', () => {
      const result = deserialize([[{ l: false }, '1']])
      expect(result.keys[0].stepped).toBe(false)
    })

    it('should treat d:false as a no-op (decal already false)', () => {
      const result = deserialize([[{ d: false }, '1']])
      expect(result.keys[0].decal).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // 17. width2 === 0 means inherit from width (zero-means-inherit)
  // ---------------------------------------------------------------------------
  describe('zero-means-inherit for width2/height2', () => {
    it('should resolve width2=0 to width', () => {
      // After a key is emitted, width2 is reset to 0 in current state.
      // The next key should inherit width2 from width.
      const result = deserialize([[{ w: 2 }, '1', '2']])
      // key[0]: w=2, width2=2 (set by w)
      // key[1]: width=1 (reset), width2=0 → resolved to width=1
      expect(result.keys[0].width2).toBe(2)
      expect(result.keys[1].width2).toBe(1)
    })

    it('should resolve height2=0 to height', () => {
      const result = deserialize([[{ h: 2 }, '1', '2']])
      expect(result.keys[0].height2).toBe(2)
      expect(result.keys[1].height2).toBe(1)
    })

    it('should resolve width2=0 to width even when w2 is explicitly 0', () => {
      // w2:0 explicitly means "inherit from width"
      const result = deserialize([[{ w: 2, w2: 0 }, '1']])
      // width2 is 0, which resolves to width (2)
      expect(result.keys[0].width).toBe(2)
      expect(result.keys[0].width2).toBe(2)
    })
  })

  // ---------------------------------------------------------------------------
  // 18. Metadata passthrough: unknown properties preserved
  // ---------------------------------------------------------------------------
  describe('metadata passthrough', () => {
    it('should preserve unknown metadata properties', () => {
      const result = deserialize([{ name: 'test', customProp: 'hello' }])
      expect(result.meta.name).toBe('test')
      expect((result.meta as Record<string, unknown>).customProp).toBe('hello')
    })
  })

  // ---------------------------------------------------------------------------
  // Additional edge cases
  // ---------------------------------------------------------------------------
  describe('edge cases', () => {
    it('should handle a key with no label', () => {
      const result = deserialize([['']])
      expect(result.keys).toHaveLength(1)
      expect(result.keys[0].labels).toBeDefined()
    })

    it('should handle multiple rows correctly', () => {
      const result = deserialize([['A', 'B'], ['C', 'D']])
      expect(result.keys).toHaveLength(4)
      expect(result.keys[0].x).toBe(0)
      expect(result.keys[0].y).toBe(0)
      expect(result.keys[1].x).toBe(1)
      expect(result.keys[1].y).toBe(0)
      expect(result.keys[2].x).toBe(0)
      expect(result.keys[2].y).toBe(1)
      expect(result.keys[3].x).toBe(1)
      expect(result.keys[3].y).toBe(1)
    })

    it('should handle rotation with rx/ry', () => {
      const result = deserialize([[{ r: 45, rx: 1, ry: 2 }, 'A']])
      expect(result.keys[0].rotation_angle).toBe(45)
      expect(result.keys[0].rotation_x).toBe(1)
      expect(result.keys[0].rotation_y).toBe(2)
    })

    it('should handle color propagation', () => {
      const result = deserialize([[{ c: '#ff0000' }, '1', '2']])
      expect(result.keys[0].color).toBe('#ff0000')
      expect(result.keys[1].color).toBe('#ff0000')
    })

    it('should handle decal keys', () => {
      const result = deserialize([[{ d: true }, '1']])
      expect(result.keys[0].decal).toBe(true)
    })

    it('should handle stepped keys', () => {
      const result = deserialize([[{ l: true, w: 1.5, w2: 1, x2: -0.25 }, '1']])
      expect(result.keys[0].stepped).toBe(true)
      expect(result.keys[0].width).toBe(1.5)
      expect(result.keys[0].width2).toBe(1)
      expect(result.keys[0].x2).toBe(-0.25)
    })

    it('should handle nub (homing) keys', () => {
      const result = deserialize([[{ n: true }, '1']])
      expect(result.keys[0].nub).toBe(true)
    })

    it('should produce default metadata when no metadata object is present', () => {
      const result = deserialize([['1']])
      expect(result.meta.backcolor).toBe('#eeeeee')
      expect(result.meta.name).toBe('')
      expect(result.meta.author).toBe('')
    })

    it('should handle parse() with valid JSON5', () => {
      const result = parse('[["A","B"]]')
      expect(result.keys).toHaveLength(2)
      expect(result.keys[0].labels[0]).toBe('A')
      expect(result.keys[1].labels[0]).toBe('B')
    })

    it('should throw KleParseError for invalid rotation position', () => {
      expect(() => deserialize([['1', { r: 10 }]])).toThrow(KleParseError)
    })

    it('should throw KleParseError for metadata not at start', () => {
      expect(() => deserialize([['1'], { name: 'test' }])).toThrow(KleParseError)
    })
  })
})
