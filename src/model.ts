/**
 * Model normalization: map provider-specific model ids to a canonical model
 * name so the same model deployed on different vendors can be compared.
 * Aliases are user-configured; an id not listed anywhere is its own canonical.
 */

export type ModelAliases = Record<string, string[]>

/** Resolve a provider model id to its canonical model name. */
export function canonicalModel(model: string, aliases: ModelAliases): string {
  for (const [canonical, ids] of Object.entries(aliases)) {
    if (ids.includes(model)) return canonical
  }
  return model
}

/** Every distinct canonical model present across a set of model ids, sorted. */
export function distinctCanonicals(models: readonly string[], aliases: ModelAliases): string[] {
  const seen = new Set<string>()
  for (const m of models) seen.add(canonicalModel(m, aliases))
  return [...seen].sort()
}
