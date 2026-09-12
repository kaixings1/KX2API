# 系统诊断与排查工具

## 功能特性

- 系统资源检查（CPU、内存、磁盘）
- 关键服务状态检查
- 网络连接性检查
- 日志错误分析
- 配置文件语法验证
- 自动生成诊断报告

## 使用方法

### 基础用法
\`\`\`bash
bash diagnostic_tool/diagnostic.sh
\`\`\`

### 查看帮助
\`\`\`bash
bash diagnostic_tool/diagnostic.sh --help
\`\`\`

## 配置文件说明

- \`config/checklist.conf\` - 检查项配置
- \`config/thresholds.conf\` - 阈值配置

## 日志位置

诊断报告保存在 \`logs/\` 目录下。

## 自动化排查

工具会自动：
1. 检测系统资源瓶颈
2. 识别服务异常
3. 分析日志错误
4. 验证配置文件
5. 生成详细报告

## 故障处理建议

根据诊断结果，工具会提供相应的处理建议。
"# KX2API" 
