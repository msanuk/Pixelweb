import type { GuideModel } from '@pixelweb/shared';
import type { OcConfig, OcProviders } from '../opencode/client.js';

/**
 * The model a new guide session runs on. The guide sends no model, so OpenCode picks: the
 * default agent's model, else the configured one, else a provider's default. This reads the
 * same settings in the same order (OpenCode's last resort, recently used models, isn't
 * visible from here).
 */
export function defaultModelId(providers: OcProviders, config: OcConfig): string | null {
  const agent = config.default_agent ?? 'build';
  const fromConfig = config.agent?.[agent]?.model ?? config.model;
  if (fromConfig) return fromConfig;
  const [provider, model] = Object.entries(providers.default ?? {})[0] ?? [];
  return provider && model ? `${provider}/${model}` : null;
}

/** A "providerID/modelID" as the extension shows it: its name, and whether it reads images. */
export function describeModel(providers: OcProviders, id: string | null | undefined): GuideModel | null {
  if (!id) return null;
  const slash = id.indexOf('/');
  const provider = slash > 0 ? id.slice(0, slash) : '';
  const modelID = slash > 0 ? id.slice(slash + 1) : id;
  const models = providers.providers?.find((p) => p.id === provider)?.models ?? {};
  const m = models[modelID] ?? Object.values(models).find((x) => x.id === modelID);
  const image = m?.capabilities?.input?.image;
  return { id, name: m?.name || modelID, image: typeof image === 'boolean' ? image : null };
}
