// @ts-check
// Redaction and vendor detection for cloud console captures. The browser extension runs it
// before anything leaves the page, and the server runs it again on what arrives, so the two
// can't drift apart. Plain JS (typed by capture.d.ts) for the same reason as steps.js.

/** @typedef {import('./index.js').PageCapture} PageCapture */
/** @typedef {import('./index.js').CapturedField} CapturedField */
/** @typedef {import('./index.js').CloudVendor} CloudVendor */

export const MASK = '‹已隐藏›';

/** @type {[CloudVendor, RegExp][]} */
const VENDORS = [
  ['aliyun', /(^|\.)(aliyun\.com|alibabacloud\.com)$/],
  ['aws', /(^|\.)(aws\.amazon\.com|amazonaws\.cn|amazonaws\.com)$/],
  ['huaweicloud', /(^|\.)huaweicloud\.com$/],
  ['azure', /(^|\.)(azure\.com|azure\.cn)$/],
  ['gcp', /(^|\.)cloud\.google\.com$/],
];

/** @param {string} hostname */
export function vendorOf(hostname) {
  const host = hostname.toLowerCase();
  for (const [vendor, re] of VENDORS) if (re.test(host)) return vendor;
  return null;
}

/** Key formats that are secrets wherever they appear. */
const KEYS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  /\b(?:AKIA|ASIA|ABIA|ACCA)[A-Z0-9]{16}\b/g, // AWS access key ID
  /\bLTAI[A-Za-z0-9]{12,30}\b/g, // Alibaba Cloud AccessKey ID
  /\bAIza[0-9A-Za-z_-]{35}\b/g, // Google API key
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, // JWT
  /\b(?:ghp|gho|ghu|ghs|ghr|github_pat|pwx|xox[abprs])_[A-Za-z0-9_-]{16,}/g,
  /\bsk-[A-Za-z0-9_-]{20,}/g,
];

/** The value after a label that names a secret: "AccessKey Secret: …", "AccountKey=…", "密码：…". */
const LABELLED = /((?:secret|密钥|私钥|口令|密码|password|passwd|token|令牌|accountkey|sharedaccesskey|sig)(?:[ _-]?(?:key|id))?\s*[:：=]\s*)([^\s,;，；"'<>&]{6,})/gi;

/** Runs of characters a random token is made of; "-" and "/" included so base64 secrets stay whole. */
const TOKENISH = /(?<![A-Za-z0-9+/=_-])[A-Za-z0-9+/=_-]{24,}(?![A-Za-z0-9+/=_-])/g;

/**
 * A long string that switches between upper case, lower case, digits and symbols as often as
 * random text does. Words don't: "AmazonEC2ContainerRegistryReadOnly" (a policy name the user
 * needs to see) switches about once every three characters, a random secret every one or two.
 * @param {string} s
 */
function looksRandom(s) {
  if (!/[a-z]/.test(s) || !/[A-Z]/.test(s) || !/[0-9]/.test(s)) return false;
  /** @param {string} c */
  const cls = (c) => (/[a-z]/.test(c) ? 0 : /[A-Z]/.test(c) ? 1 : /[0-9]/.test(c) ? 2 : 3);
  let runs = 1;
  for (let i = 1; i < s.length; i++) if (cls(s[i]) !== cls(s[i - 1])) runs++;
  return runs / s.length >= 0.4;
}

/**
 * Masks secrets in free text.
 * @param {string} text
 * @returns {{ text: string; count: number }}
 */
export function redactText(text) {
  let count = 0;
  let out = text;
  for (const re of KEYS) {
    out = out.replace(re, () => {
      count++;
      return MASK;
    });
  }
  out = out.replace(LABELLED, (/** @type {string} */ _m, /** @type {string} */ label, /** @type {string} */ value) => {
    if (value === MASK) return label + value;
    count++;
    return label + MASK;
  });
  out = out.replace(TOKENISH, (m) => {
    if (!looksRandom(m)) return m;
    count++;
    return MASK;
  });
  return { text: out, count };
}

const SECRET_LABEL = /secret|密钥|私钥|密码|口令|password|passphrase|token|令牌|credential|凭证|private.?key/i;
/** Labels that mention a secret but hold something harmless: "密钥对名称", "Token 有效期". */
const HARMLESS_LABEL = /名称|name|类型|type|有效期|期限|过期|长度|length|格式|format/i;

/** A field whose whole value is a secret, judged by its label. @param {string} label */
export function isSecretLabel(label) {
  return SECRET_LABEL.test(label) && !HARMLESS_LABEL.test(label);
}

/** Kinds whose value is typed in; a select or radio holds one of its option names ("登录凭证：自定义密码"). */
const TYPED = new Set(['text', 'textarea', 'other']);

/** @param {CapturedField} f */
function holdsSecret(f) {
  return !!f.value && f.value !== MASK && TYPED.has(f.kind) && !f.options?.includes(f.value) && isSecretLabel(f.label);
}

const SECRET_PARAM = /token|sig|secret|key|auth|session|code|password|credential|^x-amz-/i;

/**
 * Drops credentials and secret-looking query parameters from a URL; the region and the hash
 * route (Alibaba Cloud consoles route with "#/…") stay, as they tell which page this is.
 * @param {string} url
 * @returns {{ url: string; count: number }}
 */
export function cleanUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return { url: '', count: 0 };
  }
  let count = 0;
  if (u.username || u.password) {
    u.username = '';
    u.password = '';
    count++;
  }
  for (const name of [...new Set(u.searchParams.keys())]) {
    if (!SECRET_PARAM.test(name)) continue;
    u.searchParams.delete(name);
    count++;
  }
  const hash = redactText(decodeSafe(u.hash));
  u.hash = hash.text;
  return { url: u.toString(), count: count + hash.count };
}

/** @param {string} s */
function decodeSafe(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * The capture with every secret masked and `redactions` counting what was hidden.
 * Running it twice changes nothing more.
 * @param {PageCapture} capture
 * @returns {PageCapture}
 */
export function redactCapture(capture) {
  let count = 0;
  /** @param {string} s */
  const text = (s) => {
    const r = redactText(s);
    count += r.count;
    return r.text;
  };
  /** @param {string | undefined} s */
  const opt = (s) => (s === undefined ? undefined : text(s));
  const url = cleanUrl(capture.url);
  count += url.count;
  /** @type {CapturedField[]} */
  const fields = capture.fields.map((f) => {
    let value = f.value;
    if (holdsSecret(f)) {
      value = MASK;
      count++;
    } else value = opt(value);
    return {
      ...f,
      label: text(f.label),
      value,
      options: f.options?.map(text),
      help: opt(f.help),
      error: opt(f.error),
    };
  });
  return {
    ...capture,
    url: url.url,
    title: text(capture.title),
    breadcrumbs: capture.breadcrumbs.map(text),
    heading: text(capture.heading),
    fields,
    text: text(capture.text),
    selection: opt(capture.selection),
    redactions: (capture.redactions || 0) + count,
  };
}
