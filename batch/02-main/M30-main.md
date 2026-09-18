# M30 · 主进程根目录散落文件

- **目录**：`src/main`（根目录散落）
- **孤儿数**：10
- **状态**：✅ 已完成
- **完成时间**：2026-09-18

## 处置流程

```bash
# 1) 逐个确认引用  2) 三选一处置  3) 验证（typecheck && build && test:all）
```

> ⚠️ `.gitignore` 含 `src/**/*.js` 与 `src/**/*.d.ts` —— 这两类不被 git 跟踪。

## 处置结论

**全部归档（10/10）**，分三类：

### 一、6 个「被同名 `.ts` 取代的旧声明」

`builtin-prompts.d.ts` / `engine-bridge.d.ts` / `index.d.ts` / `lib/challenge.d.ts` /
`profiles/manager.d.ts` / `tray.d.ts` —— 六个都确认存在同名 `.ts` 实现，且 `.d.ts` 零引用。

### 二、`tray.ts`（零引用）

`src/main/tray.ts`（5.2 KB）与 `src/main/tray/TrayManager.ts` **同名概念、两个实现**。
实际使用的是后者（`src/main/index.ts:9` → `import { createTrayManager, TrayManager } from './tray/TrayManager'`）。

### 三、3 个「被 `ModuleDataStore` 取代的服务层」

| 文件 | 行数 | 说明 |
| --- | ---: | --- |
| `otherConfig/otherConfigService.ts` | 67 | 各自目录里**唯一的文件**，实现方式相同：`app.getPath` + `fs` 直接读写 JSON |
| `plugins/pluginsService.ts` | 131 | 同上 |
| `workflows/workflowsService.ts` | 111 | 同上 |

**判据**：这三个"服务类名"（`otherConfigService` / `pluginsService` / `workflowsService`）
在全仓库**零引用**；而 `src/main/ipc/ModuleDataStore.ts` 是实际在用的统一数据层
（被 `handlers.ts`、`agents/*`、`tasks/*` 使用）。这印证了项目此前记录的
「**服务层被 ModuleDataStore 取代**」这一模式。

> ⚠️ **易误判点**：`OtherConfig` / `PluginRecord` / `WorkflowRecord` 这三个**类型名**
> 在 `handlers.ts`、`preload/index.ts`、renderer 页面里都有出现 ——
> 但那是 **ModuleDataStore 使用的同名数据接口**，不是这三个 service 类。
> 又是"同名 ≠ 引用"。必须查**类名 exports**（`otherConfigService` 等），而非类型名。

归档后 `src/main/{otherConfig,plugins,workflows}/` 变空，已删除。

## 清单（10）

| 完成 | 路径 | 处置 |
| :---: | --- | --- |
| [x] | `src/main/data/builtin-prompts.d.ts` | **归档**（旧声明） |
| [x] | `src/main/engine-bridge.d.ts` | **归档**（旧声明） |
| [x] | `src/main/index.d.ts` | **归档**（旧声明） |
| [x] | `src/main/lib/challenge.d.ts` | **归档**（旧声明） |
| [x] | `src/main/otherConfig/otherConfigService.ts` | **归档**（被 ModuleDataStore 取代） |
| [x] | `src/main/plugins/pluginsService.ts` | **归档**（被 ModuleDataStore 取代） |
| [x] | `src/main/profiles/manager.d.ts` | **归档**（旧声明） |
| [x] | `src/main/tray.d.ts` | **归档**（旧声明） |
| [x] | `src/main/tray.ts` | **归档**（零引用；活的是 `tray/TrayManager.ts`） |
| [x] | `src/main/workflows/workflowsService.ts` | **归档**（被 ModuleDataStore 取代） |

## 验证记录

- `npm run typecheck` → 0 错误
- `npm run test:all` → extras **843 通过 / 0 失败**
- 顺带删除归档后变空的 `src/main/{otherConfig,plugins,workflows}/` 三个目录
