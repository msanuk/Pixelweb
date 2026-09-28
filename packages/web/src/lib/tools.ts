/** Knowledge card that explains each OpenCode tool. */
const TOOL_CARD: Record<string, string> = {
  bash: 'tool-bash',
  read: 'tool-read-edit',
  edit: 'tool-read-edit',
  write: 'tool-read-edit',
  multiedit: 'tool-read-edit',
  patch: 'tool-read-edit',
  grep: 'tool-search',
  glob: 'tool-search',
  list: 'tool-search',
  webfetch: 'tool-webfetch',
  task: 'tool-task',
  todowrite: 'tool-todo',
  todoread: 'tool-todo',
  skill: 'agent-skills',
};

/** The card for a tool call; MCP tools are namespaced ("server_tool"), anything else unknown gets the generic one. */
export function cardForTool(tool: string): string {
  return TOOL_CARD[tool.toLowerCase()] ?? (tool.includes('_') ? 'mcp' : 'tool-call');
}
