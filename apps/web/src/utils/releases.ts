import changelog from '../../CHANGELOG.md?raw'

export type ChangeCategory = 'Bug fixes' | 'Features' | 'Improvements'
export interface Release { version: string; period: string; groups: { title: string; notes: string[] }[] }

export function parseReleases(markdown: string): Release[] {
  const releases: Release[] = []
  let release: Release | undefined
  let group: Release['groups'][number] | undefined
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^## (\d+\.\d+\.\d+)(?: — (.*))?$/.exec(line)
    if (heading) {
      release = { version: heading[1], period: heading[2] ?? '', groups: [] }
      releases.push(release)
      group = undefined
    } else if (line.startsWith('## ')) {
      release = undefined
      group = undefined
    } else if (release && line.startsWith('### ')) {
      group = { title: line.slice(4), notes: [] }
      release.groups.push(group)
    } else if (release && line.startsWith('- ')) {
      if (!group) {
        group = { title: 'Release notes', notes: [] }
        release.groups.push(group)
      }
      group.notes.push(line.slice(2))
    }
  }
  return releases
}

export function releaseVersion(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date)
  const part = (name: string) => Number(parts.find((item) => item.type === name)!.value)
  return `${part('year') - 2026}.${part('month')}.${Math.min(4, Math.ceil(part('day') / 7))}`
}

export const releases = parseReleases(changelog)
export const currentVersion = releases[0].version
