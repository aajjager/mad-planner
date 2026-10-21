import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

function declarations(selector: string) {
  const start = css.indexOf(`${selector} {`)
  expect(start, `Missing palette selector ${selector}`).toBeGreaterThanOrEqual(0)
  return css.slice(start, css.indexOf('}', start))
}

function luminance(hex: string) {
  const channels = hex.match(/\w\w/g)!.map((part) => {
    const value = parseInt(part, 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

describe('Personal palette styles', () => {
  it.each(['lavender', 'terracotta', 'teal'])('provides %s colours and readable accent text in both modes', (theme) => {
    const light = declarations(`:root[data-accent="${theme}"]`)
    for (const variable of ['sage', 'dark-sage', 'peach', 'cream']) {
      expect(light).toMatch(new RegExp(`--${variable}:\\s*#[0-9a-f]{6};`))
    }
    const dark = declarations(`:root[data-mode="dark"][data-accent="${theme}"]`)
    for (const [rule, background] of [[light, 'fffaf0'], [dark, '292f2a']]) {
      const accent = rule.match(/--dark-sage:\s*#([0-9a-f]{6});/)![1]
      const values = [luminance(accent), luminance(background)].sort((a, b) => b - a)
      expect((values[0] + 0.05) / (values[1] + 0.05)).toBeGreaterThanOrEqual(4.5)
    }
  })
})
