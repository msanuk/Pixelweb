import { describe, expect, it } from 'vitest';
import type { PageCapture } from '@pixelweb/shared';
import { MASK, cleanUrl, isSecretLabel, redactCapture, redactText, vendorOf } from '@pixelweb/shared/capture';

// Made-up Alibaba Cloud keys, put together at runtime so secret scanners don't take this file for a leak.
const ALIYUN_ID = ['LTAI', '5tQ8zXk2Lp9Zr4Tw8Vn1'].join('');
const ALIYUN_SECRET = ['q7Xk2Lp9Zr4Tw8Vn1', 'Bm6Hc3Jd5Fg0Y'].join('');

describe('vendorOf', () => {
  it('knows the consoles by domain', () => {
    expect(vendorOf('ecs.console.aliyun.com')).toBe('aliyun');
    expect(vendorOf('home.console.alibabacloud.com')).toBe('aliyun');
    expect(vendorOf('us-east-1.console.aws.amazon.com')).toBe('aws');
    expect(vendorOf('console.amazonaws.cn')).toBe('aws');
    expect(vendorOf('console.huaweicloud.com')).toBe('huaweicloud');
    expect(vendorOf('portal.azure.com')).toBe('azure');
    expect(vendorOf('console.cloud.google.com')).toBe('gcp');
  });

  it('does not match look-alike hosts', () => {
    expect(vendorOf('aliyun.com.evil.example')).toBeNull();
    expect(vendorOf('notaliyun.com')).toBeNull();
    expect(vendorOf('example.com')).toBeNull();
  });
});

describe('redactText', () => {
  it('masks known key formats', () => {
    for (const secret of [
      'AKIAIOSFODNN7EXAMPLE',
      ALIYUN_ID,
      'AIzaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q',
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
      'ghp_abcdefghijklmnopqrstuvwxyz012345',
      'sk-proj-abcdefghijklmnopqrstuv',
    ]) {
      const r = redactText(`key: ${secret} end`);
      expect(r.text, secret).toBe(`key: ${MASK} end`);
      expect(r.count).toBe(1);
    }
  });

  it('masks a private key block', () => {
    const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIEow\nabc\n-----END RSA PRIVATE KEY-----';
    expect(redactText(`私钥：\n${pem}\n完`).text).toBe(`私钥：\n${MASK}\n完`);
  });

  it('masks the value after a secret label', () => {
    expect(redactText('AccessKey Secret: abcdef123456').text).toBe(`AccessKey Secret: ${MASK}`);
    expect(redactText('DefaultEndpointsProtocol=https;AccountKey=abc123def456==;EndpointSuffix=x').text).toBe(
      `DefaultEndpointsProtocol=https;AccountKey=${MASK};EndpointSuffix=x`,
    );
    expect(redactText('登录密码：Hunter2Hunter2').text).toBe(`登录密码：${MASK}`);
  });

  it('masks random-looking tokens, including base64 ones with slashes', () => {
    expect(redactText(`SK ${ALIYUN_SECRET}`).text).toBe(`SK ${MASK}`); // 30 chars, Alibaba Cloud secret length
    expect(redactText('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY').text).toBe(MASK);
  });

  it('leaves names, ids and words alone', () => {
    const keep = [
      'AmazonEC2ContainerRegistryReadOnly',
      'AWSServiceRoleForAutoScaling',
      'i-bp1g6zv0ce8oghu7k2ab',
      'sg-0123456789abcdef0',
      '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
      'arn:aws:iam::123456789012:role/MyLambdaRole2024',
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      '密钥对名称：my-keypair-2024',
      'Token 有效期：3600',
    ];
    for (const s of keep) expect(redactText(s), s).toEqual({ text: s, count: 0 });
  });

  it('is idempotent', () => {
    const once = redactText('AccessKey Secret: abcdef123456, id AKIAIOSFODNN7EXAMPLE').text;
    expect(redactText(once)).toEqual({ text: once, count: 0 });
  });
});

describe('isSecretLabel', () => {
  it('flags secret fields but not their names or settings', () => {
    expect(isSecretLabel('AccessKey Secret')).toBe(true);
    expect(isSecretLabel('登录密码')).toBe(true);
    expect(isSecretLabel('确认密码')).toBe(true);
    expect(isSecretLabel('API Token')).toBe(true);
    expect(isSecretLabel('密钥对名称')).toBe(false);
    expect(isSecretLabel('Token 有效期')).toBe(false);
    expect(isSecretLabel('实例名称')).toBe(false);
  });
});

describe('cleanUrl', () => {
  it('drops secret-looking parameters and credentials, keeps region and the hash route', () => {
    const r = cleanUrl('https://user:pw@console.aws.amazon.com/ec2/home?region=us-east-1&X-Amz-Security-Token=abc&code=xyz#Instances:sort=desc');
    expect(r.url).toBe('https://console.aws.amazon.com/ec2/home?region=us-east-1#Instances:sort=desc');
    expect(r.count).toBe(3);
    expect(cleanUrl('https://ecs.console.aliyun.com/#/server/region/cn-hangzhou').url).toBe(
      'https://ecs.console.aliyun.com/#/server/region/cn-hangzhou',
    );
  });

  it('gives up on something that is not a URL', () => {
    expect(cleanUrl('not a url')).toEqual({ url: '', count: 0 });
  });
});

describe('redactCapture', () => {
  const capture: PageCapture = {
    url: 'https://ram.console.aliyun.com/users/new?token=abc',
    title: '创建用户',
    vendor: 'aliyun',
    breadcrumbs: ['RAM 访问控制', '用户'],
    heading: '创建用户',
    fields: [
      { ref: 'f1', label: '登录名称', kind: 'text', value: 'deploy-bot' },
      { ref: 'f2', label: 'AccessKey Secret', kind: 'text', value: 'abc' },
      { ref: 'f3', label: '备注', kind: 'textarea', value: `id ${ALIYUN_ID}`, help: '可选' },
    ],
    text: `AccessKey ID ${ALIYUN_ID} 已创建`,
    redactions: 2,
    capturedAt: 1,
  };

  it('masks every part of the capture and counts on top of what the extension hid', () => {
    const r = redactCapture(capture);
    expect(r.url).toBe('https://ram.console.aliyun.com/users/new');
    expect(r.fields.map((f) => f.value)).toEqual(['deploy-bot', MASK, `id ${MASK}`]);
    expect(r.fields[2].help).toBe('可选');
    expect(r.text).toBe(`AccessKey ID ${MASK} 已创建`);
    expect(r.redactions).toBe(2 + 4);
    expect(redactCapture(r).redactions).toBe(r.redactions);
  });
});
