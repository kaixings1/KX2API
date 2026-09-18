# T2 · 主进程单元测试（vitest）

- **目录**：`src/__tests__/main`
- **孤儿数**：11
- **状态**：✅ 已完成
- **完成时间**：2026-09-18

## 处置流程

```bash
# 1) 逐个确认引用  2) 三选一处置  3) 验证（typecheck && build && test:all）
```

> ⚠️ `.gitignore` 含 `src/**/*.js` 与 `src/**/*.d.ts` —— 这两类不被 git 跟踪。

## 处置结论

**全部保留（0 个删除/归档）** —— 与 T3 同属「假孤儿：测试文件」类。
测试无人 import（终端消费者），但由 vitest 自动收集执行。

实测验证：

```bash
node ./node_modules/vitest/vitest.mjs run src/__tests__/main
# → Test Files  11 passed (11)
#    Tests      156 passed (156)
```

11 个文件、**156 个用例全部在跑**，且依赖全部完整：

`defaultData` / `hooks` / `ipc-handlers` / `ipcChannelConsistency` / `loadBalancerConfig` /
`permissionConfig` / `preloadChannelGuard` / `proxyRuntimeLimits` / `textRuntimeLimits` /
`toolSessionStore` / `variantSelector`（均 ✅）

## 清单（11）

| 完成 | 路径 | 处置 |
| :---: | --- | --- |
| [x] | `src/__tests__/main/defaultData.test.ts` | **保留**（活跃测试） |
| [x] | `src/__tests__/main/hooks.test.ts` | **保留** |
| [x] | `src/__tests__/main/ipc-handlers.test.ts` | **保留** |
| [x] | `src/__tests__/main/ipcChannelConsistency.test.ts` | **保留** |
| [x] | `src/__tests__/main/loadBalancerConfig.test.ts` | **保留** |
| [x] | `src/__tests__/main/permissionConfig.test.ts` | **保留** |
| [x] | `src/__tests__/main/preloadChannelGuard.test.ts` | **保留** |
| [x] | `src/__tests__/main/proxyRuntimeLimits.test.ts` | **保留** |
| [x] | `src/__tests__/main/textRuntimeLimits.test.ts` | **保留** |
| [x] | `src/__tests__/main/toolSessionStore.test.ts` | **保留** |
| [x] | `src/__tests__/main/variantSelector.test.ts` | **保留** |

## 验证记录

- `vitest run src/__tests__/main` → 11 files / 156 tests passed
- 本批**未改动任何文件**，无回归风险
