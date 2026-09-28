import type { OcMessageWithParts, OcUserMessage } from '@pixelweb/shared';
import type { PromptInput } from './client.js';

/**
 * The settings a follow-up prompt has to repeat to continue the session as it was.
 *
 * OpenCode doesn't carry them over: a prompt without `agent` runs the default agent,
 * and one without `variant` drops the reasoning level. Either changes the system
 * prompt or tool list at the very start of the request, so the provider's prompt
 * cache misses on the whole conversation — and a `plan` session would suddenly be
 * allowed to edit files. The model is inherited by OpenCode already, but only after
 * the agent's own model, so it's pinned too.
 */
export function followUpSettings(messages: OcMessageWithParts[]): Omit<PromptInput, 'parts'> {
  let last: OcUserMessage | undefined;
  for (let i = messages.length - 1; i >= 0 && !last; i--) {
    const info = messages[i].info;
    if (info.role === 'user') last = info;
  }
  if (!last) return {};
  const out: Omit<PromptInput, 'parts'> = {};
  if (last.agent) out.agent = last.agent;
  if (last.model) {
    out.model = { providerID: last.model.providerID, modelID: last.model.modelID };
    if (last.model.variant) out.variant = last.model.variant;
  }
  if (last.system) out.system = last.system;
  if (last.tools && Object.keys(last.tools).length) out.tools = last.tools;
  return out;
}
