// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extractPage, tidy, type Dom } from '../src/content/extract';

// happy-dom has no layout: "visible" means not inside something hidden
const shown = (el: Element) => !el.closest('[hidden], [style*="display: none"], [style*="display:none"]');
const dom: Dom = { visible: shown, rendered: shown };

const load = (name: string) => new DOMParser().parseFromString(readFileSync(`${__dirname}/fixtures/${name}.html`, 'utf8'), 'text/html');
const html = (body: string) => new DOMParser().parseFromString(`<!doctype html><html><body>${body}</body></html>`, 'text/html');
const byLabel = (doc: Document) => Object.fromEntries(extractPage(doc, dom).capture.fields.map((f) => [f.label, f]));

describe('extractPage on an Alibaba Cloud style form', () => {
  const { capture, elements } = extractPage(load('aliyun-ecs'), dom);
  const f = Object.fromEntries(capture.fields.map((x) => [x.label, x]));

  it('reads the page around the form', () => {
    expect(capture.title).toBe('云服务器 ECS - 创建实例');
    expect(capture.heading).toBe('创建实例');
    expect(capture.breadcrumbs).toEqual(['云服务器 ECS', '实例', '创建实例']);
    expect(elements).toHaveLength(capture.fields.length);
  });

  it('finds every visible field in order, with its section', () => {
    expect(capture.fields.map((x) => x.label)).toEqual([
      '付费类型',
      '地域',
      '实例规格',
      '镜像',
      '系统盘容量（GiB）',
      '公网 IP',
      '带宽计费模式',
      '带宽峰值（Mbps）',
      '安全组规则 · HTTP 80',
      '安全组规则 · HTTPS 443',
      '安全组规则 · SSH 22',
      '登录凭证',
      '登录密码',
      '实例名称',
      '描述',
    ]);
    expect(f['付费类型'].section).toBe('基础配置');
    expect(f['公网 IP'].section).toBe('网络和安全组');
    expect(f['描述'].section).toBe('管理设置');
  });

  it('groups radios into one field, by container or by name', () => {
    expect(f['付费类型']).toMatchObject({ kind: 'radio', value: '按量付费', options: ['包年包月', '按量付费', '抢占式实例'], required: true });
    expect(f['登录凭证']).toMatchObject({ kind: 'radio', value: '自定义密码', options: ['密钥对', '自定义密码'] });
    expect(f['带宽计费模式']).toMatchObject({ kind: 'radio', value: '按使用流量', options: ['按固定带宽', '按使用流量'] });
  });

  it('reads custom and native selects, and a placeholder as empty', () => {
    expect(f['地域']).toMatchObject({ kind: 'select', value: '华东1（杭州）', required: true });
    expect(f['实例规格']).toMatchObject({ kind: 'select', value: 'ecs.e-c1m2.large（2 vCPU 4 GiB）' });
    expect(f['实例规格'].options).toHaveLength(3);
    expect(f['镜像']).toMatchObject({ kind: 'select', value: '' });
  });

  it('reads switches, checkboxes and numbers', () => {
    expect(f['公网 IP']).toMatchObject({ kind: 'switch', value: '开' });
    expect(f['安全组规则 · HTTPS 443']).toMatchObject({ kind: 'checkbox', value: '未勾选' });
    expect(f['带宽峰值（Mbps）']).toMatchObject({ kind: 'number', value: '5', help: '1 - 200 Mbps，按使用流量时只是上限' });
  });

  it('never reads a password', () => {
    expect(f['登录密码'].kind).toBe('text');
    expect(f['登录密码'].value).toBeUndefined();
    expect(JSON.stringify(capture)).not.toContain('Hunter2');
  });

  it('keeps help and error apart', () => {
    expect(f['实例名称']).toMatchObject({ value: 'pixelweb_server', error: '名称不能包含下划线' });
    expect(f['实例名称'].help).toBeUndefined();
  });

  it('skips hidden fields and the console top bar and menu', () => {
    expect(f['实例 RAM 角色']).toBeUndefined();
    expect(capture.fields.some((x) => x.label.includes('搜索'))).toBe(false);
    expect(capture.text).not.toContain('弹性块存储');
    expect(capture.text).not.toContain('工单');
    expect(capture.text).not.toContain('AliyunECSInstanceRole');
  });

  it('keeps the text outside <main>, like the price bar', () => {
    expect(capture.text).toContain('配置费用：¥ 0.452 /时');
    expect(capture.text).toContain('按量付费的实例按秒计费');
  });
});

describe('extractPage on an AWS Cloudscape style form', () => {
  const { capture } = extractPage(load('aws-ec2'), dom);
  const f = Object.fromEntries(capture.fields.map((x) => [x.label, x]));

  it('follows for, aria-labelledby and aria-describedby', () => {
    expect(f['Name']).toMatchObject({ kind: 'text', value: 'pixelweb', help: 'A tag with the key "Name".', section: 'Name and tags' });
    expect(f['Instance type']).toMatchObject({ kind: 'select', value: 't3.micro' });
  });

  it('reads a select drawn as a button, without its hint or placeholder', () => {
    expect(f['Key pair name']).toMatchObject({ kind: 'select', value: '', help: 'You can use a key pair to securely connect to your instance.' });
  });

  it('reads a checkbox switch, fieldset radios and a spinbutton', () => {
    expect(f['Auto-assign public IP']).toMatchObject({ kind: 'switch', value: '开' });
    expect(f['Firewall (security groups)']).toMatchObject({ kind: 'radio', value: 'Create security group', section: 'Network settings' });
    expect(f['Allow SSH traffic from']).toMatchObject({ value: 'Anywhere 0.0.0.0/0', options: ['Anywhere 0.0.0.0/0', 'My IP'] });
    expect(f['Size (GiB)']).toMatchObject({ kind: 'number', value: '8', required: true });
  });

  it('skips the console search box', () => {
    expect(capture.fields.find((x) => x.label === 'Search')).toBeUndefined();
    expect(capture.breadcrumbs).toEqual(['EC2', 'Instances', 'Launch an instance']);
  });
});

describe('extractPage edge cases', () => {
  it('goes into open shadow roots', () => {
    const doc = html('<div id="host"></div>');
    const root = doc.getElementById('host')!.attachShadow({ mode: 'open' });
    root.innerHTML = '<label for="q">配额</label><input id="q" type="number" value="3">';
    expect(byLabel(doc)['配额']).toMatchObject({ kind: 'number', value: '3' });
  });

  it('falls back to the text right before a control', () => {
    const doc = html('<div><span>保留天数</span><input value="7"></div>');
    expect(byLabel(doc)['保留天数']).toMatchObject({ value: '7' });
  });

  it('reads a listbox and its selected options', () => {
    const doc = html(
      '<div><span id="l">可用区</span><ul role="listbox" aria-labelledby="l" aria-multiselectable="true">' +
        '<li role="option" aria-selected="true">可用区 H</li><li role="option">可用区 I</li><li role="option" aria-selected="true">可用区 J</li></ul></div>',
    );
    expect(byLabel(doc)['可用区']).toMatchObject({ kind: 'select', value: '可用区 H、可用区 J', options: ['可用区 H', '可用区 I', '可用区 J'] });
  });

  it('reads the options of an open custom select', () => {
    const doc = html(
      '<label for="c">操作系统</label><input id="c" role="combobox" aria-expanded="true" aria-controls="pop" value="">' +
        '<div id="pop" role="listbox"><div role="option">Alibaba Cloud Linux</div><div role="option">Ubuntu</div></div>',
    );
    expect(byLabel(doc)['操作系统'].options).toEqual(['Alibaba Cloud Linux', 'Ubuntu']);
  });

  it('marks disabled fields', () => {
    const doc = html('<label for="a">专有网络</label><input id="a" value="vpc-1" disabled><fieldset disabled><label for="b">交换机</label><input id="b" value="vsw-1"></fieldset>');
    const f = byLabel(doc);
    expect(f['专有网络'].disabled).toBe(true);
    expect(f['交换机'].disabled).toBe(true);
  });

  it('includes the selection and which fields are inside it', () => {
    const doc = document; // a parsed document has no window, so no selection
    doc.body.innerHTML =
      '<div id="a"><label for="x">实例名称</label><input id="x" value="web"></div>' +
      '<div id="b"><p>带宽按使用流量计费</p><label for="y">带宽峰值</label><input id="y" type="number" value="5"></div>';
    const range = doc.createRange();
    range.selectNodeContents(doc.getElementById('b')!);
    doc.getSelection()!.removeAllRanges();
    doc.getSelection()!.addRange(range);
    const c = extractPage(doc, dom).capture;
    expect(c.selection).toContain('带宽按使用流量计费');
    expect(c.selected).toEqual([1]);
    doc.getSelection()!.removeAllRanges();
    expect(extractPage(doc, dom).capture.selected).toBeUndefined();
  });

  it('outlines a radio group without a container around all its options', () => {
    const doc = html(
      '<div class="item"><span>登录凭证</span><div id="opts"><label><input type="radio" name="c" checked>密钥对</label><label><input type="radio" name="c">密码</label></div></div>',
    );
    const { elements } = extractPage(doc, dom);
    expect(elements[0]).toBe(doc.getElementById('opts'));
  });
});

describe('tidy', () => {
  it('trims, drops blank and repeated lines, and cuts to the budget', () => {
    expect(tidy('  a  \n\n\tb   c\nb   c\n d')).toBe('a\nb c\nd');
    expect(tidy('x'.repeat(30), 10)).toBe('x'.repeat(10) + '\n…（正文太长，后面省略）');
  });
});
