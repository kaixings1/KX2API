import type { ToolCallingConfig } from '../../../shared/toolCalling.ts'
import type { NormalizedClientToolRequest } from './clientAdapters/types.ts'
import { getProviderToolProfile } from './providerProfiles.ts'
import { DEFAULT_ALLOWED_NAMES } from './protocols/managedXml.ts'
import type { FallbackStrategy, ToolCallingPlan } from './types.ts'

export function buildToolCallingRuntimePlan(input: {
  requestId?: string
  providerId: string
  actualModel?: string
  model?: string
  config: ToolCallingConfig
  clientRequest: NormalizedClientToolRequest
}): ToolCallingPlan {
  const profile = getProviderToolProfile(input.providerId)
  const tools = input.clientRequest.tools
  const toolNames = new Set(tools.map((tool) => tool.name))
  const forcedName = input.clientRequest.toolChoice.forcedName

  if (input.clientRequest.toolChoice.mode === 'forced' && forcedName && !toolNames.has(forcedName)) {
    throw new Error(`Forced tool ${forcedName} is not declared`)
  }

  const allowedToolNames = forcedName ? new Set([forcedName]) : toolNames
  const allowedTools = forcedName ? tools.filter((tool) => tool.name === forcedName) : tools
  const disabledReason = getDisabledReason(
    input.config,
    allowedTools.length,
    input.clientRequest.toolChoice.mode,
    profile.managedSupport,
  )
  const mode = disabledReason ? 'disabled' : 'managed'
  const protocol = profile.preferredManagedProtocol
  const shouldInjectPrompt = mode === 'managed'
  const shouldParseResponse = mode === 'managed'

  // 协议级 fallback 策略。
  //
  // managed_xml 用 never：它的结构化解析已覆盖本项目已知的全部输出形态
  // （含 surge 子标签 <tool_call><toolName>…</toolName></tool_call> 与
  //  GLM bracket [function_calls][call:…][/call]，见 protocols/managedXml.ts 的 parse 流程），
  // 不需要跨协议兜底。开着兜底反而会把**不属于本协议**的格式也解析出来，
  // 破坏「非流式只接受选定协议」的契约
  // （由 tests/tool-calling/tool-engine.test.ts 与 types.ts 的 FallbackStrategy 注释锁定）。
  //
  // 其余协议解析器覆盖度不足，保留 always 以免模型输出被静默当成正文。
  //
  // 注：此处曾一度硬编码为 'always'（为修 surge 格式静默失败），但那属于过度修正 ——
  // surge 格式的正解是加进 managed_xml 的解析流程（已实现），而非对全部协议开兜底。
  const fallbackStrategy: FallbackStrategy = protocol === 'managed_xml' ? 'never' : 'always'

  return {
    mode,
    protocol,
    clientAdapterId: input.clientRequest.clientAdapterId,
    providerId: input.providerId,
    tools: allowedTools,
    shouldInjectPrompt,
    shouldParseResponse,
    toolChoiceMode: input.clientRequest.toolChoice.mode,
    allowedToolNames,
    forcedToolName: forcedName,
    fallbackStrategy,
    diagnostics: {
      requestId: input.requestId,
      clientAdapterId: input.clientRequest.clientAdapterId,
      providerId: input.providerId,
      model: input.model,
      actualModel: input.actualModel,
      toolSource: input.clientRequest.toolSource,
      mode,
      protocol,
      toolCount: allowedTools.length,
      injected: shouldInjectPrompt,
      reason: disabledReason ?? `managed_${input.config.mode}`,
      toolChoiceMode: input.clientRequest.toolChoice.mode,
      forcedToolName: forcedName,
      allowedToolNames: [...allowedToolNames],
    },
  }
}

function getDisabledReason(
  config: ToolCallingConfig,
  toolCount: number,
  toolChoiceMode: string,
  managedSupport: boolean,
): string | undefined {
  if (!config.enabled || config.mode === 'off') return 'mode_off'
  if (toolChoiceMode === 'none') return 'tool_choice_none'
  if (toolCount === 0) return 'no_tools'
  if (!managedSupport && config.mode === 'auto') return 'provider_not_supported'
  return undefined
}
