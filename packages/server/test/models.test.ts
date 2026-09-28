import { describe, expect, it } from 'vitest';
import { toModelInfo } from '../src/opencode/models.js';

describe('toModelInfo', () => {
  it('keys limits by provider/model and keeps compaction settings', () => {
    const info = toModelInfo(
      {
        providers: [
          { id: 'anthropic', models: { 'claude-sonnet-4': { id: 'claude-sonnet-4', limit: { context: 200_000, output: 64_000 } } } },
          { id: 'openai', models: { 'gpt-x': { limit: { context: 400_000, input: 272_000, output: 128_000 } }, local: { limit: { context: 0, output: 0 } } } },
        ],
      },
      { compaction: { auto: false, reserved: 10_000 } },
    );
    expect(info.limits).toEqual({
      'anthropic/claude-sonnet-4': { context: 200_000, output: 64_000 },
      'openai/gpt-x': { context: 400_000, input: 272_000, output: 128_000 },
    });
    expect(info.compaction).toEqual({ auto: false, reserved: 10_000 });
  });

  it('defaults to automatic compaction', () => {
    expect(toModelInfo({ providers: [] }, {}).compaction).toEqual({ auto: true });
  });
});
