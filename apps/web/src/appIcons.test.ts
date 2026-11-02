import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const asset = (name: string) => readFileSync(resolve(process.cwd(), 'public', name))

describe('installable app artwork', () => {
  it('provides opaque PNG icons at their declared sizes and links the Apple icon', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
    expect(html).toContain('rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon-v2.png"')
    const manifest = JSON.parse(asset('manifest.webmanifest').toString())
    expect(manifest.start_url).toBe('/recipes')
    expect(manifest.id).toBe('/planner') // Preserve the previous installed-app identity.
    for (const [name, size] of [['apple-touch-icon-v2.png', 180], ['icon-v2-192.png', 192], ['icon-v2-512.png', 512]] as const) {
      const png = asset(name)
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
      expect(png.readUInt32BE(16)).toBe(size)
      expect(png.readUInt32BE(20)).toBe(size)
      expect(png[25]).toBe(2) // Truecolour RGB: no transparent pixels or pre-cut corners.
      if (size !== 180) expect(manifest.icons).toContainEqual(expect.objectContaining({ src: `/${name}`, sizes: `${size}x${size}`, type: 'image/png' }))
    }
  })

  it('uses the new artwork in the manifest, offline shell and notifications', () => {
    const manifest = JSON.parse(asset('manifest.webmanifest').toString())
    for (const icon of manifest.icons) expect(asset(icon.src.slice(1)).length).toBeGreaterThan(0)
    const worker = asset('service-worker.js').toString()
    expect(worker).toContain('madplanner-shell-v5')
    expect(worker).toContain("icon: '/icon-v2-192.png'")
    for (const file of ['favicon-v2.svg', 'apple-touch-icon-v2.png', 'icon-v2-192.png', 'icon-v2-512.png']) expect(worker).toContain(`/${file}`)
  })
})
