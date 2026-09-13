# Token队列工具提取器

## 设计思路

采用30-50个token的滑动窗口队列进行工具提取：

1. **队列保证不丢失**：所有流式内容进入队列，不会因为处理速度而丢失
2. **队头检测工具标志**：只需检查队头内容即可判断是否为工具调用
3. **滑动窗口机制**：队列满时自动丢弃最旧token，保持最新上下文

## 核心特性

- **TokenQueue**: 30-50 token滑动窗口，自动维护队头/队尾
- **ToolExtractor**: 基于队头标志检测的工具提取器
- **Configurable**: 通过YAML配置队列大小和检测规则

## 快速开始

\`\`\`bash
pip install pyyaml
python src/main.py
\`\`\`

## 运行测试

\`\`\`bash
pytest tests/ -v
\`\`\`
