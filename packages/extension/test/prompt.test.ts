import { describe, expect, it } from 'vitest';
import type { PageCapture } from '@pixelweb/shared';
// the server writes these prompts; reading them back must follow its format
import { buildGuidePrompt } from '../../server/src/ext/prompt';
import { readPrompt, refChip } from '../src/lib/prompt';
import { shortPath, toolLine } from '../src/lib/tools';
import { serverOrigin } from '../src/lib/api';

const capture: PageCapture = {
  url: 'https://ecs.console.aliyun.com/server/create',
  title: '云服务器 ECS',
  vendor: 'aliyun',
  breadcrumbs: ['云服务器 ECS'],
  heading: '创建实例',
  fields: [
    { ref: 'f1', label: '付费类型', kind: 'radio', value: '按量付费', options: ['包年包月', '按量付费'] },
    { ref: 'f2', label: '带宽（Mbps）', kind: 'number', value: '5', required: true },
    { ref: 'f3', label: '', kind: 'text' },
  ],
  text: '正文',
  redactions: 0,
  capturedAt: 1,
};

describe('readPrompt', () => {
  it('reads a first capture: the question, the page and the refs', () => {
    const v = readPrompt(buildGuidePrompt({ capture, question: '带宽选多少？' }, { first: true, projectRoot: '/p' }));
    expect(v.question).toBe('带宽选多少？');
    expect(v.page).toEqual({ vendor: '阿里云', heading: '创建实例', host: 'ecs.console.aliyun.com', fields: 3, next: false });
    expect(v.refs).toEqual({ f1: '付费类型', f2: '带宽（Mbps）', f3: '（无标签）' });
  });

  it('knows a next-page capture and the default question', () => {
    const v = readPrompt(buildGuidePrompt({ capture }, { first: false }));
    expect(v.page?.next).toBe(true);
    expect(v.question).toContain('这一页该怎么填');
  });

  it('passes a plain follow-up through', () => {
    expect(readPrompt(buildGuidePrompt({ question: '  为什么？ ' }, { first: false }))).toEqual({ question: '为什么？', refs: {} });
  });
});

describe('refChip', () => {
  it('adds the label only when the reply does not name the field after the tag', () => {
    expect(refChip('f1', '付费类型', ' 付费类型 | 按量付费')).toBe('f1');
    expect(refChip('f8', '带宽峰值（Mbps）', '带宽峰值')).toBe('f8');
    expect(refChip('f9', '安全组规则 · HTTP 80', ' HTTP 80、')).toBe('f9');
    expect(refChip('f3', '实例规格', '')).toBe('f3 实例规格');
    expect(refChip('f3', '实例规格', ' 实例名称')).toBe('f3 实例规格');
    expect(refChip('f7', undefined, '')).toBe('f7');
  });
});

describe('toolLine', () => {
  const done = (input: Record<string, unknown>) => ({ status: 'completed' as const, input, output: '', title: 't', metadata: {}, time: { start: 0, end: 1 } });

  it('describes reads and searches relative to the project', () => {
    expect(toolLine('read', done({ filePath: '/home/me/app/src/index.ts' }), '/home/me/app')).toMatchObject({ verb: '读取', target: 'src/index.ts' });
    expect(toolLine('read', done({ filePath: 'C:\\work\\app\\Dockerfile' }), 'C:\\work\\app')).toMatchObject({ target: 'Dockerfile' });
    expect(toolLine('grep', done({ pattern: 'PORT' }))).toMatchObject({ verb: '搜索代码', target: 'PORT' });
  });

  it('links fetched docs, and only http(s) ones', () => {
    expect(toolLine('webfetch', done({ url: 'https://help.aliyun.com/zh/ecs/user-guide/overview' }))).toMatchObject({
      verb: '查文档',
      target: 'help.aliyun.com/zh/ecs/user-guide/overview',
      href: 'https://help.aliyun.com/zh/ecs/user-guide/overview',
    });
    expect(toolLine('webfetch', done({ url: 'javascript:alert(1)' })).href).toBeUndefined();
  });

  it('shortens paths outside the project', () => {
    expect(shortPath('/etc/nginx/nginx.conf', '/home/me/app')).toBe('nginx/nginx.conf');
  });
});

describe('serverOrigin', () => {
  it('takes a URL, host:port or a bare port', () => {
    expect(serverOrigin('http://192.168.1.10:7420/')).toBe('http://192.168.1.10:7420');
    expect(serverOrigin(' 192.168.1.10:7420 ')).toBe('http://192.168.1.10:7420');
    expect(serverOrigin('https://pixelweb.example.com/settings')).toBe('https://pixelweb.example.com');
    expect(serverOrigin('7420')).toBe('http://127.0.0.1:7420');
  });

  it('refuses what is not an http(s) address', () => {
    expect(serverOrigin('')).toBeNull();
    expect(serverOrigin('ftp://host')).toBeNull();
    expect(serverOrigin('http://')).toBeNull();
  });
});
