import { describe, expect, it } from 'vitest'
import { calculateImageHeight } from './image-size.js'

describe('calculateImageHeight', () => {
  it('aspectRatioが無ければfallbackHeightを返す', () => {
    expect(calculateImageHeight(30, undefined, 6, 12, 12, 4, 20)).toBe(12)
  })

  it('横長画像(16:9)は行数を横幅より小さく計算する', () => {
    // raw = 30cols * 6px * 9 / (16 * 12px) = 1620 / 192 = 8.4375 -> round 8
    expect(calculateImageHeight(30, { width: 16, height: 9 }, 6, 12, 12, 4, 20)).toBe(8)
  })

  it('縦長画像は計算結果がmaxHeightを超えたらクランプする', () => {
    // raw = 30cols * 6px * 16 / (9 * 12px) = 2880 / 108 = 26.67 -> round 27 -> clamp to 20
    expect(calculateImageHeight(30, { width: 9, height: 16 }, 6, 12, 12, 4, 20)).toBe(20)
  })

  it('計算結果がminHeightを下回ったらクランプする', () => {
    // 極端な横長画像
    expect(calculateImageHeight(30, { width: 100, height: 1 }, 6, 12, 12, 4, 20)).toBe(4)
  })

  it('aspectRatioのwidthまたはheightが0以下ならfallbackHeightを返す', () => {
    expect(calculateImageHeight(30, { width: 0, height: 9 }, 6, 12, 12, 4, 20)).toBe(12)
  })
})
