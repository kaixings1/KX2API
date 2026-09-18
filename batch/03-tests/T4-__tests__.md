# T4 · 测试根目录散落文件

- **目录**：`src/__tests__`（根目录散落文件）
- **孤儿数**：1
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

本批只有 1 个文件，**已在 X2 批次顺带处置**（它测试的模块被归档，测试必须跟着走，
否则 vitest 会因找不到被导入的模块而失败）。

| 文件 | 关联 | 处置 |
| --- | --- | --- |
| `src/__tests__/shared/textTruncate.test.ts` | 测试 `src/shared/textTruncate.ts`（终端场景的宽度截断，Electron 用 CSS `truncate`，无 JS 需求） | **归档**（与模块成对） |

**原则**：删除/归档被测模块时，**测试必须同步处置** —— 只归档模块会留下
引用不存在模块的测试，vitest 直接报错；只归档测试（留模块）则模块彻底失守。

## 清单（1）

| 完成 | 路径 | 处置 | D:\src 来源（严格匹配） |
| :---: | --- | --- | --- |
| [x] | `src/__tests__/shared/textTruncate.test.ts` | **归档** → `legacy/src/__tests__/shared/textTruncate.test.ts`（随 X2 一并） | — |

## 验证记录

- 已随 X2 验证：`npm run test:all` → extras 841 通过；unit 1162 通过（较原 1208 少 46，
  正是本测试文件的用例数，符合预期）
- 归档后 `src/__tests__/` 只剩 `components/`、`engine/`、`main/` 三个目录
