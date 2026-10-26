import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { localizedReleases, currentVersion, parseReleases, releases, releaseVersion } from './releases'

describe('calendar releases', () => {
  it.each([[1, 1], [7, 1], [8, 2], [14, 2], [15, 3], [18, 3], [21, 3], [22, 4], [28, 4], [29, 4], [31, 4]])('maps October day %i to week %i', (day, week) => {
    expect(releaseVersion(new Date(`2026-10-${String(day).padStart(2, '0')}T12:00:00Z`))).toBe(`0.10.${week}`)
  })
  it('uses Copenhagen midnight, calendar months, and the next year', () => {
    expect(releaseVersion(new Date('2026-10-07T22:30:00Z'))).toBe('0.10.2')
    expect(releaseVersion(new Date('2026-10-31T23:30:00Z'))).toBe('0.11.1')
    expect(releaseVersion(new Date('2026-12-31T23:30:00Z'))).toBe('1.1.1')
    expect(releaseVersion(new Date('2027-02-28T12:00:00Z'))).toBe('1.2.4')
  })
  it('packages the canonical changelog without drift and aligns the API version', () => {
    const root = readFileSync('../../CHANGELOG.md', 'utf8')
    expect(readFileSync('CHANGELOG.md', 'utf8')).toBe(root)
    expect(readFileSync('../api/pyproject.toml', 'utf8')).toContain(`version = "${currentVersion}"`)
    expect(releases.some((release) => release.version === '0.2.5')).toBe(true)
  })
  it('preserves categories and legacy notes without merging releases', () => {
    const parsed = parseReleases('## 0.10.3 — October\n### Features\n- New feature\n### Bug fixes\n- Fixed issue\n## 0.2.5 — Legacy\n- Older entry\n## Other\n- Not a release')
    expect(parsed.map((release) => release.groups)).toEqual([
      [{ title: 'Features', notes: ['New feature'] }, { title: 'Bug fixes', notes: ['Fixed issue'] }],
      [{ title: 'Release notes', notes: ['Older entry'] }],
    ])
  })
})

describe('translated release history', () => {
  it.each(['da', 'nl'] as const)('translates every note and category while preserving release identities in %s', (locale) => {
    const localized = localizedReleases(locale)
    expect(localized.map((release) => release.version)).toEqual(releases.map((release) => release.version))
    localized.forEach((release, index) => {
      expect(release.period).not.toBe(releases[index].period)
      release.groups.forEach((group, groupIndex) => {
        const original = releases[index].groups[groupIndex]
        expect(group.title).not.toBe(original.title)
        expect(group.notes).toHaveLength(original.notes.length)
        group.notes.forEach((note, noteIndex) => {
          expect(note.trim().length).toBeGreaterThan(0)
          expect(note).not.toBe(original.notes[noteIndex])
        })
      })
    })
    expect(localizedReleases('en')).toBe(releases)
  })
})
