import { registerHooks } from 'node:module'
import path from 'node:path'
import { accessSync, constants } from 'node:fs'
import { pathToFileURL } from 'node:url'

const projectRoot = process.cwd()
const candidateExtensions = ['', '.ts', '.tsx', '.js', '.mjs', '.cjs']

function findAliasedModule(specifier) {
  if (!specifier.startsWith('@/')) {
    return null
  }

  const basePath = path.join(projectRoot, 'src', specifier.slice(2))
  const candidates = [
    ...candidateExtensions.map((extension) => `${basePath}${extension}`),
    ...candidateExtensions.map((extension) => path.join(basePath, `index${extension}`)),
  ]

  for (const candidate of candidates) {
    try {
      accessSync(candidate, constants.F_OK)
      return pathToFileURL(candidate).href
    } catch {
      continue
    }
  }

  return null
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const aliasedModuleUrl = findAliasedModule(specifier)
    if (aliasedModuleUrl) {
      return {
        shortCircuit: true,
        url: aliasedModuleUrl,
      }
    }

    return nextResolve(specifier, context)
  },
})
