/**
 * AgentCardBody — 卡片主体：systemPrompt 预览、模型和创建时间
 */

// AgentRecord 用渲染进程的全局声明（electron.d.ts），与 electronAPI.agents
// 返回的形状一致。跨层 import main/agents/types 会引入第二份同名类型，
// 导致两者互不兼容（TS2322）。

interface AgentCardBodyProps {
  agent: AgentRecord
}

export function AgentCardBody({ agent }: AgentCardBodyProps) {
  return (
    <>
      <p className="text-sm text-muted-foreground line-clamp-3">{agent.systemPrompt}</p>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {agent.model && <span>Model: {agent.model}</span>}
        <span>ID: {agent.id}</span>
        <span>创建: {new Date(agent.createdAt).toLocaleDateString()}</span>
      </div>
    </>
  )
}
