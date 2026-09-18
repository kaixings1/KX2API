# X4 · 记忆（顶层）

- **目录**：`src/memory`
- **孤儿数**：1（D:\src 可靠来源 1 个）
- **状态**：✅ 已完成
- **完成时间**：2026-09-18

## 处置流程

```bash
# 1) 逐个确认引用（含动态 import、字符串路径、配置引用）
#    逐文件查：grep -rn "<文件名去掉后缀>" src tests scripts
# 2) 三选一处置：
#    - 确认无引用        → git rm 具体文件（勿按后缀批量删）
#    - 有参考价值        → 移动到 legacy/ 对应目录
#    - 其实有用只是没接线 → 接线并补测试
# 3) 验证（必须全过才能勾选）
npm run typecheck && npm run build && npm run test:all
```

> ⚠️ `.gitignore` 含 `src/**/*.js` 与 `src/**/*.d.ts` —— 这两类不被 git 跟踪，
> 按后缀删会误伤手写声明（如 `src/renderer/src/types/electron.d.ts`）。
> 只删本文件清单里逐个确认过的具体文件。

## 处置结论

| 文件 | 判断 | 处置 |
| --- | --- | --- |
| `src/memory/memory_tool.py` | Python 参考实现。同目录的 `memoryTool.ts` 头部注释写明「来源: anthropics/claude-cookbooks/tool_use/memory_tool.py」，即 **`.py` 是移植的上游源**，有溯源价值 | **归档到** `legacy/src/memory/memory_tool.py` |

**归档理由**：`.py` 在 TypeScript 项目里不参与构建、不被引用，留在 `src/` 只会
干扰「接入体检」。但它是移植依据，删掉会丢失溯源 —— 故移入 `legacy/`
（该目录不被 git 跟踪、不参与构建、需要时可原样搬回）。

## 清单（1）

| 完成 | 路径 | 处置 | D:\src 来源（严格匹配） |
| :---: | --- | --- | --- |
| [x] | `src/memory/memory_tool.py` | **归档** → `legacy/src/memory/memory_tool.py` | `D:\src\memory\memory_tool.py`（high） |

## 验证记录

- `npm run typecheck` → 0 错误
- `npm run test:all`（extras 段）→ 841 通过，0 失败
- 工作目录 `src/memory/` 归档后只剩生效的 `memoryTool.ts`
