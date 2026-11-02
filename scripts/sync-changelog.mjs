import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'

const source = new URL('../CHANGELOG.md', import.meta.url)
copyFileSync(source, new URL('../apps/web/CHANGELOG.md', import.meta.url))
// Package release eligibility with the API, without exposing private feedback.
const markdown = readFileSync(source, 'utf8')
const release = /^## (\d+\.\d+\.\d+)[^\n]*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(markdown)
if (!release) throw new Error('No completed release found')
writeFileSync(new URL('../apps/api/src/madplanner/release-notes.json', import.meta.url), JSON.stringify({ version: release[1], has_changes: /^- \S/m.test(release[2]) }, null, 2) + '\n')
