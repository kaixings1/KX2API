# M13 · OAuth 登录 oauth

- **目录**：`src/main/oauth`
- **孤儿数**：21（D:\src 可靠来源 1 个）
- **状态**：⬜ 未开始
- **完成时间**：—

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

## 清单（21）

| 完成 | 路径 | 处置 | D:\src 来源（严格匹配） |
| :---: | --- | --- | --- |
| [ ] | `src/main/oauth/__tests__/stepfun-session-token.test.ts` | | — |
| [ ] | `src/main/oauth/adapters/base.d.ts` | | — |
| [ ] | `src/main/oauth/adapters/deepseek.d.ts` | | — |
| [ ] | `src/main/oauth/adapters/glm.d.ts` | | — |
| [ ] | `src/main/oauth/adapters/index.d.ts` | | — |
| [ ] | `src/main/oauth/adapters/kimi.d.ts` | | — |
| [ ] | `src/main/oauth/adapters/mimo.d.ts` | | — |
| [ ] | `src/main/oauth/adapters/minimax.d.ts` | | — |
| [ ] | `src/main/oauth/adapters/perplexity.d.ts` | | — |
| [ ] | `src/main/oauth/adapters/qwen-ai.d.ts` | | — |
| [ ] | `src/main/oauth/adapters/qwen.d.ts` | | — |
| [ ] | `src/main/oauth/adapters/stepfun.d.ts` | | — |
| [ ] | `src/main/oauth/adapters/zai.d.ts` | | — |
| [ ] | `src/main/oauth/guides.d.ts` | | — |
| [ ] | `src/main/oauth/guides.ts` | | — |
| [ ] | `src/main/oauth/inAppLogin.d.ts` | | — |
| [ ] | `src/main/oauth/index.ts` | | `D:\src\services\\oauth\\index.ts`（high） |
| [ ] | `src/main/oauth/kimiSessionManager.d.ts` | | — |
| [ ] | `src/main/oauth/manager.d.ts` | | — |
| [ ] | `src/main/oauth/tokenExtractionConfig.d.ts` | | — |
| [ ] | `src/main/oauth/types.d.ts` | | — |
