# E1 · 工具参数修复层 tool-harness

- **目录**：`src/engine/tool-harness`
- **孤儿数**：10
- **状态**：✅ 已完成
- **完成时间**：2026-09-18

## 处置流程

```bash
# 1) 逐个确认引用  2) 三选一处置  3) 验证（typecheck && build && test:all）
```

> ⚠️ `.gitignore` 含 `src/**/*.js` 与 `src/**/*.d.ts` —— 这两类不被 git 跟踪。

## ⚠️ 本轮踩的坑（务必记住）

我第一轮把 `repair/` 整目录 + `index.ts` + `types.ts` + 2 个测试全部归档，
结果 **`typecheck` / `unit` / `build` 三项齐挂**。原因：

**只检查了「谁引用 repair」，没检查「repair 被谁引用」。**

`jsonSchemaRepair.ts`（**活的**，被 `toolScheduler.ts` 使用）**依赖 `repair/` 里的两个文件**：

```ts
// src/engine/tool-harness/jsonSchemaRepair.ts
import { normalizeKeys } from './repair/key-normalize.ts'
import { repairJSON } from './repair/json-repair.ts'
```

而且依赖是**递归**的：

```
jsonSchemaRepair.ts
  ├─ repair/key-normalize.ts
  │    └─ repair/levenshtein.ts
  │         └─ types.ts
  └─ repair/json-repair.ts
       └─ types.ts  (+ 外部包 jsonrepair)
```

共需恢复 4 个文件（`key-normalize` / `json-repair` / `levenshtein` / `types`）。
恢复后 `typecheck` 0 / `extras` 843 / `unit` 1116 / `build` ✅ 全部恢复。

> 📌 **教训**：处置一个**目录**时，不能只看"目录整体是否被引用"，
> 必须**递归检查目录内每个文件被谁 import**。所谓"孤儿目录"里
> 可能藏着活模块的依赖（尤其 `types.ts` / `utils.ts` 这种被当基础件引用的名字）。
> **归档后立刻跑 typecheck 是唯一可靠的兜底。**

## 处置结论（修正后）

`tool-harness/` 是「**两套修复实现并存**」：`jsonSchemaRepair.ts` 是**按 JSON Schema 重写的适配层**
（活），`repair/` 是**按 Zod 判断类型的旧流水线**（对本项目不生效）。

| 文件 | 引用 / 依赖 | 处置 |
| --- | --- | --- |
| `jsonSchemaRepair.ts`（252 行） | ✅ 活：被 `toolScheduler.ts:8` 用（`needsRepair` / `repairArgsBySchema`） | **保留** |
| `repair/key-normalize.ts` | 被 `jsonSchemaRepair` 依赖 | **保留**（依赖闭包） |
| `repair/json-repair.ts` | 被 `jsonSchemaRepair` 依赖 | **保留**（依赖闭包） |
| `repair/levenshtein.ts` | 被 `key-normalize` 依赖 | **保留**（依赖闭包） |
| `types.ts` | 被 `key-normalize`/`json-repair`/`levenshtein` 依赖（本身 `import zod`） | **保留**（依赖闭包） |
| `index.ts` | 零引用（barrel） | **归档** |
| `repair/defaults.ts` | 零引用（按 Zod 判断类型，对本项目不生效） | **归档** |
| `repair/fuzzy-enum.ts` | 零引用 | **归档** |
| `repair/index.ts` | 零引用 | **归档** |
| `repair/semantic-enum.ts` | 零引用 | **归档** |
| `repair/structured-error.ts` | 零引用 | **归档** |
| `repair/synonym-table.ts` | 零引用 | **归档** |
| `repair/type-coerce.ts` | 零引用 | **归档** |
| `__tests__/repair.test.ts` | 测 `repair/index.ts` + `types.ts`（已归档/仅剩依赖） | **归档**（成对） |
| `__tests__/repair-layer.test.ts` | 测 `repair/synonym-table.ts`（已归档） | **归档**（成对） |

**归档合计 10 个**；保留 5 个（`jsonSchemaRepair.ts` + 4 个依赖闭包文件）。

> 关于 `repair/` 那套流水线为何整体失效：`jsonSchemaRepair.ts` 的文件头注释已解释 ——
> 它其中 **6 层按 Zod 的 `_def.typeName` 判断字段类型**，而本项目全程用 JSON Schema
> （`{ type: 'string' }`），依赖不匹配导致这些层完全不生效，整条流水线无人调用。
> 这正是 `tool-harness/` 长期是孤儿的根因，也是当初写 `jsonSchemaRepair` 适配层的原因。

## 清单（10）

| 完成 | 路径 | 处置 |
| :---: | --- | --- |
| [x] | `src/engine/tool-harness/__tests__/repair-layer.test.ts` | **归档**（成对） |
| [x] | `src/engine/tool-harness/__tests__/repair.test.ts` | **归档**（成对） |
| [x] | `src/engine/tool-harness/index.ts` | **归档**（零引用 barrel） |
| [x] | `src/engine/tool-harness/repair/defaults.ts` | **归档** |
| [x] | `src/engine/tool-harness/repair/fuzzy-enum.ts` | **归档** |
| [x] | `src/engine/tool-harness/repair/index.ts` | **归档** |
| [x] | `src/engine/tool-harness/repair/semantic-enum.ts` | **归档** |
| [x] | `src/engine/tool-harness/repair/structured-error.ts` | **归档** |
| [x] | `src/engine/tool-harness/repair/synonym-table.ts` | **归档** |
| [x] | `src/engine/tool-harness/repair/type-coerce.ts` | **归档** |

**未在清单内但必须保留**（依赖闭包）：`repair/key-normalize.ts`、`repair/json-repair.ts`、
`repair/levenshtein.ts`、`types.ts`。

## 验证记录

- `npm run typecheck` → **0 错误**
- `npm run test:all` → extras **843 通过 / 0 失败**；unit **1116 通过**
- `npm run build` → **成功**
