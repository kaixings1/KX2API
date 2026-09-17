/**
 * main/hooks/index.ts — 钩子系统门面
 *
 * 钩子让用户在 agent 主循环的关键节点挂自己的脚本：拦工具调用、注入上下文、
 * 阻止继续执行。配置来自用户的 `<userData>/hooks.json`（见 hookConfig.ts 的
 * 安全边界说明：不接受项目目录里的钩子定义）。
 *
 * 配置示例：
 * ```json
 * {
 *   "hooks": {
 *     "PreToolUse": [
 *       {
 *         "matcher": "bash|shell",
 *         "hooks": [
 *           { "type": "command", "command": "echo '{\"decision\":\"deny\",\"reason\":\"禁止执行 shell\"}'" }
 *         ]
 *       }
 *     ],
 *     "Stop": [
 *       { "hooks": [ { "type": "command", "command": "./scripts/check.sh", "timeout": 30 } ] }
 *     ]
 *   }
 * }
 * ```
 */

export * from './types.ts'
export {
  setHooksConfigPath,
  getHooksConfigPath,
  loadHooksConfig,
  clearHooksConfigCache,
  getMatchingHooks,
  hasHooksFor,
  writeHooksConfig,
} from './hookConfig.ts'
export {
  runHooks,
  runPreToolUse,
  runPostToolUse,
  runUserPromptSubmit,
  runStop,
  killProcessTree,
  resolveHookShell,
  resetHookShellCache,
  DEFAULT_HOOK_TIMEOUT_MS,
  SESSION_END_HOOK_TIMEOUT_MS,
} from './hookRunner.ts'

/** 写入一份带注释的示例配置（首次启动时用，方便用户上手） */
export const SAMPLE_HOOKS_CONFIG = {
  hooks: {
    PreToolUse: [
      {
        matcher: 'bash|shell|powershell',
        hooks: [
          {
            type: 'command',
            command:
              'echo \'{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask"}}\'',
          },
        ],
      },
    ],
    Stop: [],
  },
}
