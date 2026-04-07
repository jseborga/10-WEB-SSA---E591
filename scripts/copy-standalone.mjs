import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const standaloneRoot = join(root, '.next', 'standalone')
const standaloneNextRoot = join(standaloneRoot, '.next')
const staticSource = join(root, '.next', 'static')
const staticTarget = join(standaloneNextRoot, 'static')
const publicSource = join(root, 'public')
const publicTarget = join(standaloneRoot, 'public')

mkdirSync(standaloneNextRoot, { recursive: true })

if (existsSync(staticSource)) {
  cpSync(staticSource, staticTarget, { recursive: true, force: true })
}

if (existsSync(publicSource)) {
  cpSync(publicSource, publicTarget, { recursive: true, force: true })
}
