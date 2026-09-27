import type { ModelInfo, OcModelLimit } from '@pixelweb/shared';

type Providers = { providers: { id: string; models: Record<string, { id?: string; limit?: OcModelLimit }> }[] };
type Config = { compaction?: { auto?: boolean; reserved?: number } };

/** Flattens OpenCode's provider list to limits keyed "providerID/modelID". Models without a context size are left out. */
export function toModelInfo(providers: Providers, config: Config): ModelInfo {
  const limits: Record<string, OcModelLimit> = {};
  for (const p of providers.providers ?? []) {
    for (const [key, m] of Object.entries(p.models ?? {})) {
      const l = m.limit;
      if (!l || !(l.context > 0)) continue;
      limits[`${p.id}/${m.id ?? key}`] = { context: l.context, output: l.output ?? 0, ...(l.input ? { input: l.input } : {}) };
    }
  }
  const c = config.compaction ?? {};
  return { limits, compaction: { auto: c.auto !== false, ...(typeof c.reserved === 'number' ? { reserved: c.reserved } : {}) } };
}
