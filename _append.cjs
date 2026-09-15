const fs = require('fs')
const file = 'TASK.md'
const append = `

## 工具管理前端交互细化（ToolGroupsPanel）（2026-09-15）

改进点（均在 src/renderer/src/pages/ToolManagement/ToolGroupsPanel.tsx）：
- [x] 组内工具列表新增内联搜索（按工具名/别名/描述过滤）
- [x] 工具按平台分组折叠展示（全部/Windows/Unix，含 sticky 分组头计数）
- [x] 新增批量操作：全选 / 清空（对当前过滤结果批量启停）
- [x] 「被跳过」工具改为默认折叠的 details 区，不再堆满一行
- [x] 生效清单限制展示前 60 个 + 折叠被跳过项，避免 254 个全平铺
- [x] 「另存为组」改为 Dialog 对话框，带名称非空/重名校验
- [x] 拆分视觉分区（Separator 分隔 生效/编辑 两个区块）
- [x] 移除 ScrollArea（滚动行为不可靠），改用原生 overflow-y-auto 滚动容器
- [x] 修正多个引用命名冲突（isCheckedIn/applyBatch），消除未知变量

说明：各翻译键仍沿用 i18next fallback 默认值风格，未改 locale JSON。
验证：ts.transpileModule 语法校验通过；错误引用扫描无残留。运行时效果待 npm run dev 人工确认。
`
fs.appendFileSync(file, append, 'utf8')
console.log('已追加到 TASK.md，总行数:', fs.readFileSync(file, 'utf8').split('\n').length)