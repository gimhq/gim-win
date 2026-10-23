import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pkg from '../../../../package.json'
import licences from './licences.json'

// Regenerate with `bun run licences` when a dependency changes.

function cargoDependencyNames(): string[] {
  const toml = readFileSync(join(__dirname, '../../../../src-tauri/Cargo.toml'), 'utf8')
  const names: string[] = []
  let inDeps = false
  for (const line of toml.split('\n')) {
    const header = line.match(/^\s*\[([^\]]+)\]/)
    if (header) {
      inDeps = /^dependencies$|^target\..+\.dependencies$/.test(header[1].trim())
      continue
    }
    const entry = inDeps && line.match(/^([\w-]+)\s*=/)
    if (entry)
      names.push(entry[1])
  }
  return names
}

describe('licences.json', () => {
  it('lists every npm dependency', () => {
    const npm = licences.filter(entry => entry.source === 'npm').map(entry => entry.name)
    for (const name of Object.keys(pkg.dependencies))
      expect(npm).toContain(name)
  })

  it('lists every cargo dependency', () => {
    const cargo = licences.filter(entry => entry.source === 'cargo').map(entry => entry.name)
    const names = cargoDependencyNames()
    expect(names).toContain('tauri')
    for (const name of names)
      expect(cargo).toContain(name)
  })

  it('is sorted by name', () => {
    const names = licences.map(entry => entry.name)
    expect(names).toEqual([...names].sort())
  })
})
