import { readFileSync, writeFileSync } from 'node:fs'

const p = 'src/engine/subagent/config.ts'
let s = readFileSync(p, 'utf-8')
const before = s
const NL = s.includes('\r\n') ? '\r\n' : '\n'

/**
 * subAgentManager.ts 是「已写完的消费者」，而 SubAgentConfig 仍是基础版，
 * 于是 35 处报「字段不存在」。这里按消费者**实际用到的形状**补齐类型
 * （字段语义与注释取自 manager 中的用法，不凭空发明）：
 *
 *   skillTree    ← updateSkillProficiency 读写 mastered / learning / proficiency / lastUpdated
 *   assembly     ← createQueryEngine 读取 tools / knowledge / memory / systemPromptTemplate
 *   capabilities ← findByCapabilities 用于能力标签匹配
 *   priority     ← listByPriority / routeByModel 用于排序
 *   modelId      ← routeByModel 用于按模型路由（与 model 不同：model 是调用模型，modelId 是路由标识）
 */
const re = /export interface SubAgentConfig \{\r?\n  name: string;\r?\n  description: string;\r?\n  systemPrompt\?: string;\r?\n  model\?: string;\r?\n  maxTokens\?: number;\r?\n  allowedTools\?: string\[\];\r?\n  maxIterations\?: number;\r?\n  timeout\?: number;\r?\n  accessParentContext\?: boolean;\r?\n\}/

if (!re.test(s)) {
  console.log('未命中 SubAgentConfig')
  process.exit(1)
}

const newIface = [
  'export interface SubAgentConfig {',
  '  name: string;',
  '  description: string;',
  '  systemPrompt?: string;',
  '  model?: string;',
  '  maxTokens?: number;',
  '  allowedTools?: string[];',
  '  maxIterations?: number;',
  '  timeout?: number;',
  '  accessParentContext?: boolean;',
  '',
  '  // ── 以下为编排/路由所需的可选扩展（由 subAgentManager 消费） ──',
  '',
  '  /** 用于按模型路由的标识（与 model 不同：model 是实际调用的模型名） */',
  '  modelId?: string;',
  '  /** 路由优先级，数值越大越优先（listByPriority / routeByModel 据此排序） */',
  '  priority?: number;',
  '  /** 能力标签，供 findByCapabilities 做任务匹配 */',
  '  capabilities?: string[];',
  '  /**',
  '   * Harness 组装策略（吸收自 ag2 AssemblyPolicy）。',
  '   * 决定子代理系统提示里注入哪些内容。',
  '   */',
  '  assembly?: {',
  '    /** 工具暴露范围：不暴露 / 全部 / 按 allowedTools 受限 */',
  "    tools: 'none' | 'all' | 'restricted';",
  '    /** 知识注入方式：按需检索 / 全量预注入 */',
  "    knowledge: 'query_based' | 'full';",
  '    /** 记忆注入范围：仅最近 / 完整历史 */',
  "    memory: 'recent' | 'full';",
  '    /** 系统提示模板名（可选） */',
  '    systemPromptTemplate?: string;',
  '  };',
  '  /**',
  '   * 自进化技能树：执行成功/失败会调整 proficiency，达到阈值后进入 mastered。',
  '   * 由 updateSkillProficiency 就地修改（故 proficiency 为可变对象）。',
  '   */',
  '  skillTree?: {',
  '    /** 已掌握（proficiency ≥ 0.8） */',
  '    mastered: string[];',
  '    /** 学习中 */',
  '    learning: string[];',
  '    /** 技能名 → 熟练度 [0,1] */',
  '    proficiency: Record<string, number>;',
  '    /** 最近更新时间 */',
  '    lastUpdated?: number;',
  '  };',
  '}',
].join(NL)

s = s.replace(re, newIface)

// 给内置代理补上扩展字段示例值：让能力标签/优先级/组装策略真正可用
const extras = {
  '"code-reviewer"': {
    modelId: 'claude-3-5-sonnet',
    priority: 80,
  },
  '"test-generator"': {
    modelId: 'claude-3-5-sonnet',
    priority: 70,
  },
  '"doc-generator"': {
    modelId: 'claude-3-5-sonnet',
    priority: 60,
  },
  refactorer: {
    modelId: 'claude-3-5-sonnet',
    priority: 75,
  },
}

for (const [key, val] of Object.entries(extras)) {
  // 在该条目的 maxTokens 行后插入
  const re2 = new RegExp(
    `(\\n  ${key.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}: \\{[\\s\\S]*?maxTokens: \\d+,)`,
  )
  if (!re2.test(s)) {
    console.log('未命中条目: ' + key)
    continue
  }
  s = s.replace(re2, (m) => m + `${NL}    modelId: "${val.modelId}",${NL}    priority: ${val.priority},`)
}

writeFileSync(p, s)
console.log('已改: ' + p)
