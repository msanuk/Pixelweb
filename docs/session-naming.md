# 会话命名

会话标题统一为 `yyyymmdd-动词对象` 的格式，只用中文，总长度不超过 25 个字，例如 `20260928-修复登录跳转`。标题由 OpenCode 和 PixelWeb 分两步生成。

## 1. OpenCode 生成标题

OpenCode 在会话的第一条消息之后，会用隐藏的 `title` agent 生成一次标题，它的提示词可以替换。把 [opencode-title-prompt.txt](opencode-title-prompt.txt) 放到服务器上，然后在 OpenCode 的配置文件（全局的 `~/.config/opencode/opencode.json`，或项目里的 `opencode.json`）中加上：

```json
{
  "agent": {
    "title": { "prompt": "{file:./title-prompt.txt}" }
  }
}
```

`{file:...}` 中的相对路径以这个配置文件所在目录为准。想用更便宜的模型生成标题，可以再加一项 `"model": "provider/model"`。修改后重启 `opencode serve`，之后新建的会话才会生效。

## 2. PixelWeb 补上日期

`title` agent 不知道当天的日期，所以日期前缀由 PixelWeb 添加：OpenCode 写入标题后，PixelWeb 按会话的创建日期把它改成 `yyyymmdd-…`，超过 25 个字的部分会被截掉。新标题会写回 OpenCode，在终端里也能看到。

在时间线标题旁点铅笔图标（或双击标题）可以手动改名，同样会自动加上日期。启动时加 `--no-title-date`（或设置 `PIXELWEB_TITLE_DATE=0`）可以关闭这一步。

## 不会改名的会话

- 子任务。OpenCode 用任务描述加 `(@agent subagent)` 给它们命名。
- 讲解会话。
- 还没有标题的会话。
- 标题已经带日期的会话。

旧会话不会被批量改名，下次有新动静（比如继续对话）时才会改。PixelWeb 没有运行时生成的标题不带日期，等 PixelWeb 运行期间这个会话有了新动静才会补上。
