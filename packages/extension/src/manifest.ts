/**
 * Cloud consoles the extension may read. Required rather than optional: the
 * extension is loaded unpacked for exactly these sites, and it only reads a
 * page when the user asks (捕捉 in the side panel, or the right-click menu; no
 * content scripts are declared). Kept in step with vendorOf in
 * @pixelweb/shared/capture.
 */
export const CONSOLE_HOSTS = [
  'https://*.aliyun.com/*',
  'https://*.alibabacloud.com/*',
  'https://*.aws.amazon.com/*',
  'https://*.amazonaws.cn/*',
  'https://*.huaweicloud.com/*',
  'https://*.azure.com/*',
  'https://*.azure.cn/*',
  'https://console.cloud.google.com/*',
];

/**
 * manifest.json. The PixelWeb server can be any address, so its origin is an
 * optional permission asked for when the user connects. The e2e build also
 * holds loopback, where the test server and pages run, because a permission
 * prompt can't be clicked from a test.
 */
export function manifest(version: string, opts: { e2e?: boolean } = {}) {
  return {
    manifest_version: 3,
    name: 'PixelWeb 云控制台向导',
    version,
    description: '看不懂云控制台的配置页时，把这一页发给 PixelWeb，结合你的项目告诉你怎么填。',
    minimum_chrome_version: '116',
    action: { default_title: 'PixelWeb 云控制台向导' },
    side_panel: { default_path: 'sidepanel.html' },
    background: { service_worker: 'background.js', type: 'module' },
    // contextMenus + activeTab: the right-click menu, which reads pages outside the known consoles
    permissions: ['sidePanel', 'scripting', 'storage', 'contextMenus', 'activeTab'],
    host_permissions: opts.e2e ? [...CONSOLE_HOSTS, 'http://127.0.0.1/*', 'http://localhost/*'] : CONSOLE_HOSTS,
    optional_host_permissions: ['http://*/*', 'https://*/*'],
  };
}
