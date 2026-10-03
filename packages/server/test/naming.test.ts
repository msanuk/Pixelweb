import { describe, expect, it } from 'vitest';
import type { OcSession } from '@pixelweb/shared';
import { TITLE_MAX, applyConvention, conventionalTitle, datePrefix, tidyTitle } from '../src/opencode/naming.js';

const created = new Date(2026, 8, 28, 14, 3).getTime(); // local time, like the prefix
const ses = (title: string, extra: Partial<OcSession> = {}): OcSession => ({ id: 's', title, time: { created, updated: created }, ...extra });

describe('datePrefix', () => {
  it('is the local date as yyyymmdd', () => {
    expect(datePrefix(created)).toBe('20260928');
    expect(datePrefix(new Date(2026, 0, 5, 0, 1).getTime())).toBe('20260105');
  });
});

describe('tidyTitle', () => {
  it('drops quotes and trailing punctuation a model adds', () => {
    expect(tidyTitle('“修复登录跳转”。')).toBe('修复登录跳转');
    expect(tidyTitle('  排查  500 错误 ')).toBe('排查 500 错误');
  });
});

describe('applyConvention', () => {
  it('puts the creation date in front', () => {
    expect(applyConvention('修复登录跳转', created)).toBe('20260928-修复登录跳转');
  });
  it('keeps a date that is already there', () => {
    expect(applyConvention('20260101-修复登录跳转', created)).toBe('20260101-修复登录跳转');
  });
  it('caps the whole title at 25 characters', () => {
    const t = applyConvention('把整个项目的依赖全部升级到最新的大版本并修好所有测试', created);
    expect(Array.from(t)).toHaveLength(TITLE_MAX);
    expect(t.startsWith('20260928-把整个项目')).toBe(true);
  });
});

describe('conventionalTitle', () => {
  it('renames a titled root session', () => {
    expect(conventionalTitle(ses('修复登录跳转'))).toBe('20260928-修复登录跳转');
  });
  it('leaves alone what OpenCode or PixelWeb names on purpose', () => {
    expect(conventionalTitle(ses('New session - 2026-09-28T06:03:00.000Z'))).toBeNull();
    expect(conventionalTitle(ses('搜索代码 (@explore subagent)', { parentID: 'p' }))).toBeNull();
    expect(conventionalTitle(ses('📖 Webhook'))).toBeNull();
    expect(conventionalTitle(ses('🧭 阿里云 创建实例'))).toBeNull();
    expect(conventionalTitle(ses('20260928-修复登录跳转'))).toBeNull();
  });
});
