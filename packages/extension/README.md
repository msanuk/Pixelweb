# 云控制台向导

在阿里云、AWS 等云控制台里遇到看不懂的配置页时，用这个 Chrome / Edge 插件把当前页面发给 PixelWeb。PixelWeb 会在当前项目下开一个只读的向导会话，结合项目代码说明每一项该怎么填、需要注意什么。回答显示在插件侧边栏里，PixelWeb 的时间线里也能看到同一个会话。

设计文档见 [docs/cloud-guide.md](../../docs/cloud-guide.md)。

## 安装

```bash
npm run build --workspace=@pixelweb/extension   # 产物在 packages/extension/dist
```

1. 在 Chrome 中打开 `chrome://extensions`（Edge 是 `edge://extensions`），开启「开发者模式」，点「加载已解压的扩展程序」，选择 `packages/extension/dist`。
2. 在 PixelWeb 里打开 设置 → 浏览器插件，生成一个 token。token 只显示一次。
3. 点浏览器工具栏上的插件图标打开侧边栏，填写 PixelWeb 地址和 token，点「连接」，再按提示允许插件访问这个地址。

## 使用

在控制台里打开要问的页面，点「捕捉这一页」，检查预览里要发送的内容，然后发送。

- 回答里的字段标签（例如 `f3`）可以点击，页面上会标出对应的那一项。
- 回答里的术语可以点击，会在 PixelWeb 里打开对应的知识卡片。VPC、安全组、AccessKey、按量付费等云概念都有卡片。
- 只想问页面上的一部分时，先选中那部分，再在预览里勾选「只发选中的部分」。
- 阿里云页面上需要鼠标悬停才显示的「?」说明，捕捉时会逐个读取。AWS 页面的帮助面板即使没有打开，也会放在正文最前面。
- 页面里嵌入了插件无权读取的其他网站时，预览会列出这些网站，点「允许读取并重新捕捉」即可。
- 模型支持图片时，可以在预览里勾选「附带截图」。截图无法隐藏密钥，所以默认不勾选，每次需要手动选择。Chrome 只允许截取通过右键菜单或工具栏图标打开插件的那个标签页。

## 权限与隐私

- 插件默认只能读取阿里云、AWS、华为云、Azure 和 GCP 控制台的页面，而且只在点击「捕捉」时读取。
- 其他网站可以在页面上右键选择「用 PixelWeb 向导看这一页」，临时允许读取当前页面。
- 发送前，密钥和密码类的值会被替换成 `‹已隐藏›`。插件从不读取密码输入框。
- 配对 token 只能发起和查看向导会话，不能批准命令。

## 开发

```bash
npm test --workspace=@pixelweb/extension
npm run build:e2e --workspace=@pixelweb/extension   # 额外加上本机地址的权限，供 Playwright 测试使用
```
