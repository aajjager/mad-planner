import { copyFileSync } from 'node:fs'

// Package the canonical changelog inside the existing web Docker build context.
copyFileSync(new URL('../CHANGELOG.md', import.meta.url), new URL('../apps/web/CHANGELOG.md', import.meta.url))
