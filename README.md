# KX2API

KX2Code - AI 编程智能体桌面端，集成代理服务与代码引擎。

## 功能

- 多供应商 AI 代理转发（StepFun、DeepSeek、GLM、Kimi、Qwen、MiniMax 等）
- OpenAI 兼容 API 代理服务（`/v1/chat/completions`）
- 模型映射与负载均衡
- OAuth 自动登录与 Token 管理
- 工具调用（Tool Use）支持
- 代码引擎与智能体协作

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 构建 Windows 可执行文件
npm run build:win
```

## 配置

在管理界面中配置供应商和账户，支持手动输入 Token 或 OAuth 自动登录。

## 技术栈

- Electron 33
- React 18 + TypeScript
- Koa (代理服务端)
- electron-vite
