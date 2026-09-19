# M21 · 请求日志 requestLogs

- **目录**：`src/main/requestLogs`
- **孤儿数**：4（D:\src 可靠来源 0 个）
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

## 处置结论（修正 2026-09-19：补充 sanitizer.d.ts，accountTrend.test 保留）

**原判定**：全部归档（2 个旧 .d.ts）。
**修正后**：归档 3 个 `.d.ts` 旧声明 + 保留 1 个活跃测试。逐批验证发现：

- 实际归属 legacy 的：`manager.d.ts`、`types.d.ts`（均已成功归档）；另 `sanitizer.d.ts`
  是**被 `sanitizer.ts` 完全取代**的旧声明（`tests/request-logs/request-log-sanitizer.test.ts`
  引用的是 `.ts` 实现，非 `.d.ts`）→ 原批次漏了它，现已补删。
- `accountTrend.test.ts` **不是孤儿/废弃**：它测试活的 `manager.ts`（`RequestLogManager`，
  vitest 用例），必须**保留**（原「全部归档」对该文件是误判）。
- `sanitizer.ts` / `manager.ts` / `types.ts` 均为活实现，保留。

> ⚠️ `.d.ts` 不被 git 跟踪（CLAUDE.md 铁律）——`sanitize.d.ts` 物理删除即可，
> 不产生 git 变更；即便在彻底删除后也不会影响构建（无人引用它）。

## 清单（4）

| 完成 | 路径 | 处置 | D:\src 来源（严格匹配） |
| :---: | --- | --- | --- |
| [x] | `src/main/requestLogs/__tests__/accountTrend.test.ts` | **保留**（测活的 manager.ts，vitest） | — |
| [x] | `src/main/requestLogs/manager.d.ts` | 归档 → `legacy/src/main/requestLogs/manager.d.ts` | — |
| [x] | `src/main/requestLogs/sanitizer.d.ts` | 归档（补删，被同名 sanitizer.ts 取代） | — |
| [x] | `src/main/requestLogs/types.d.ts` | 归档 → `legacy/src/main/requestLogs/types.d.ts` | — |
