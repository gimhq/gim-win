// Regenerates src/features/settings/about/licences.json: `bun install`, then
// `bun run licences`. npm entries are the package.json `dependencies`; cargo
// entries are the src-tauri/Cargo.toml `[dependencies]` and
// `[target.'cfg(...)'.dependencies]` names with versions from Cargo.lock.
// Cargo licences come from `cargo metadata` when cargo is on PATH, otherwise
// the previous value in licences.json is kept, else "unknown".

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outPath = join(root, 'src/features/settings/about/licences.json')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function licenceOf(value) {
  if (typeof value === 'string')
    return value
  if (value && typeof value.type === 'string')
    return value.type
  return 'unknown'
}

function npmEntries() {
  const pkg = readJson(join(root, 'package.json'))
  return Object.keys(pkg.dependencies ?? {}).map((name) => {
    const meta = readJson(join(root, 'node_modules', name, 'package.json'))
    return {
      name,
      version: meta.version,
      licence: licenceOf(meta.license),
      source: 'npm',
    }
  })
}

/** `{ name, path? }` for every key under `[dependencies]` or `[target.'...'.dependencies]`. */
function cargoDependencies() {
  const toml = readFileSync(join(root, 'src-tauri/Cargo.toml'), 'utf8')
  const deps = new Map()
  let inDeps = false
  for (const line of toml.split('\n')) {
    const header = line.match(/^\s*\[([^\]]+)\]/)
    if (header) {
      inDeps = /^dependencies$|^target\..+\.dependencies$/.test(header[1].trim())
      continue
    }
    const entry = inDeps && line.match(/^([\w-]+)\s*=(.*)$/)
    if (entry && !deps.has(entry[1]))
      deps.set(entry[1], { name: entry[1], path: entry[2].match(/path\s*=\s*"([^"]+)"/)?.[1] })
  }
  return [
    ...deps.values(),
  ]
}

/** Name -> version from the `[[package]]` blocks; the first block wins on duplicates. */
function lockVersions() {
  const lock = readFileSync(join(root, 'src-tauri/Cargo.lock'), 'utf8')
  const versions = new Map()
  for (const block of lock.split('[[package]]')) {
    const name = block.match(/^name = "([^"]+)"/m)?.[1]
    const version = block.match(/^version = "([^"]+)"/m)?.[1]
    if (name && version && !versions.has(name))
      versions.set(name, version)
  }
  return versions
}

/** Name -> licence from `cargo metadata`, or null when cargo is missing or fails. */
function cargoLicences() {
  try {
    const out = execFileSync('cargo', [
      'metadata',
      '--format-version',
      '1',
      '--locked',
      '--manifest-path',
      join(root, 'src-tauri/Cargo.toml'),
    ], {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return new Map(JSON.parse(out).packages.map(p => [p.name, p.license ?? 'unknown']))
  }
  catch {
    return null
  }
}

function cargoEntries(previous) {
  const versions = lockVersions()
  const licences = cargoLicences()
  return cargoDependencies().map(({ name, path }) => ({
    name,
    version: path ?? versions.get(name) ?? 'unknown',
    licence: licences?.get(name) ?? previous.get(name) ?? 'unknown',
    source: 'cargo',
  }))
}

const previous = new Map(
  existsSync(outPath)
    ? readJson(outPath).filter(e => e.source === 'cargo').map(e => [e.name, e.licence])
    : [],
)

const entries = [
  ...npmEntries(),
  ...cargoEntries(previous),
]
  .sort((a, b) => a.name < b.name
    ? -1
    : a.name > b.name
      ? 1
      : a.source < b.source
        ? -1
        : 1)

writeFileSync(outPath, `${JSON.stringify(entries, null, 2)}\n`)
console.log(`wrote ${entries.length} entries to ${outPath}`)
