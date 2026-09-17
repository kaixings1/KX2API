/**
 * engine/subagent/config.ts — 子代理配置（文档 02 §10.3）
 */
export interface SubAgentConfig {
  name: string;
  description: string;
  systemPrompt?: string;
  model?: string;
  maxTokens?: number;
  allowedTools?: string[];
  maxIterations?: number;
  timeout?: number;
  accessParentContext?: boolean;

  // ── 以下为编排/路由所需的可选扩展（由 subAgentManager 消费） ──

  /** 用于按模型路由的标识（与 model 不同：model 是实际调用的模型名） */
  modelId?: string;
  /** 路由优先级，数值越大越优先（listByPriority / routeByModel 据此排序） */
  priority?: number;
  /** 能力标签，供 findByCapabilities 做任务匹配 */
  capabilities?: string[];
  /**
   * Harness 组装策略（吸收自 ag2 AssemblyPolicy）。
   * 决定子代理系统提示里注入哪些内容。
   */
  assembly?: {
    /** 工具暴露范围：不暴露 / 全部 / 按 allowedTools 受限 */
    tools: 'none' | 'all' | 'restricted';
    /** 知识注入方式：按需检索 / 全量预注入 */
    knowledge: 'query_based' | 'full';
    /** 记忆注入范围：仅最近 / 完整历史 */
    memory: 'recent' | 'full';
    /** 系统提示模板名（可选） */
    systemPromptTemplate?: string;
  };
  /**
   * 自进化技能树：执行成功/失败会调整 proficiency，达到阈值后进入 mastered。
   * 由 updateSkillProficiency 就地修改（故 proficiency 为可变对象）。
   */
  skillTree?: {
    /** 已掌握（proficiency ≥ 0.8） */
    mastered: string[];
    /** 学习中 */
    learning: string[];
    /** 技能名 → 熟练度 [0,1] */
    proficiency: Record<string, number>;
    /** 最近更新时间 */
    lastUpdated?: number;
  };
}

export const predefinedAgents: Record<string, SubAgentConfig> = {
  "code-reviewer": {
    name: "code-reviewer",
    description: "审查代码中的缺陷、安全问题及最佳实践",
    systemPrompt:
      "你是一位代码审查员。识别缺陷、安全漏洞，提出改进建议，确保遵循最佳实践。",
    model: "claude-3-5-sonnet-20241022",
    allowedTools: ["file_read", "grep", "glob"],
    maxTokens: 4000,
    modelId: "claude-3-5-sonnet",
    priority: 80,
  },
  "test-generator": {
    name: "test-generator",
    description: "为代码生成单元测试",
    systemPrompt: "你是一位测试生成器。分析代码，生成全面的测试，覆盖边界情况。",
    model: "claude-3-5-sonnet-20241022",
    allowedTools: ["file_read", "file_write", "bash"],
    maxTokens: 6000,
    modelId: "claude-3-5-sonnet",
    priority: 70,
  },
  "doc-generator": {
    name: "doc-generator",
    description: "为代码生成文档",
    systemPrompt: "你是一位文档生成器。分析结构，生成带示例的清晰文档。",
    model: "claude-3-5-sonnet-20241022",
    allowedTools: ["file_read", "file_write", "grep"],
    maxTokens: 4000,
    modelId: "claude-3-5-sonnet",
    priority: 60,
  },
  refactorer: {
    name: "refactorer",
    description: "重构代码以提升质量",
    systemPrompt: "你是一位代码重构师。识别改进点，应用设计模式，保持功能不变。",
    model: "claude-3-5-sonnet-20241022",
    allowedTools: ["file_read", "file_write", "bash", "grep"],
    maxTokens: 8000,
    modelId: "claude-3-5-sonnet",
    priority: 75,
  },
};