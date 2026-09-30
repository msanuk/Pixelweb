import { describe, expect, it } from 'vitest';
import { resolveAddress } from '../src/opencode/address.js';

const current = 'http://127.0.0.1:4096';

describe('resolveAddress', () => {
  it('takes a bare port as "same host, this port"', () => {
    expect(resolveAddress('4097', current)).toEqual({ url: 'http://127.0.0.1:4097' });
    expect(resolveAddress(' 4097 ', 'https://box.lan:8443/oc')).toEqual({ url: 'https://box.lan:4097/oc' });
  });
  it('defaults to http when the scheme is left out', () => {
    expect(resolveAddress('localhost:4096', current)).toEqual({ url: 'http://localhost:4096' });
    expect(resolveAddress('192.168.1.20:4096', current)).toEqual({ url: 'http://192.168.1.20:4096' });
  });
  it('keeps a full URL, minus the trailing slash, query and fragment', () => {
    expect(resolveAddress('https://oc.example.com/', current)).toEqual({ url: 'https://oc.example.com' });
    expect(resolveAddress('http://10.0.0.5:4096/opencode/?x=1#y', current)).toEqual({ url: 'http://10.0.0.5:4096/opencode' });
  });
  it('rejects what fetch could not use', () => {
    expect(resolveAddress('', current)).toHaveProperty('error');
    expect(resolveAddress('70000', current)).toHaveProperty('error');
    expect(resolveAddress('0', current)).toHaveProperty('error');
    expect(resolveAddress('ftp://host:21', current)).toHaveProperty('error');
    expect(resolveAddress('http://', current)).toHaveProperty('error');
  });
  it('keeps credentials out of the URL, where fetch refuses them', () => {
    expect(resolveAddress('http://opencode:pw@127.0.0.1:4096', current)).toHaveProperty('error');
  });
});
