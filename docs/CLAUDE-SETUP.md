# 🤖 Claude 集成设置指南

## 快速开始（推荐）

### 方法 1: 直接使用环境变量 ✨

```bash
# 设置 API 密钥
export ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx

# 运行
./run-claude.sh
```

就这么简单！不需要 .env 文件。

### 方法 2: 使用 .env 文件（可选）

如果你不想每次都设置环境变量：

```bash
# 创建 .env 文件
cp .env.example .env

# 编辑 .env，添加你的密钥
# ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx

# 运行
./start-with-claude.sh
```

## 三种运行模式对比

### 1. 🧪 测试模式（模拟器）
```bash
node super.js
# 或
export USE_REAL_CLAUDE=false
node super.js
```
- ✅ 免费
- ✅ 快速
- ✅ 适合开发测试
- ❌ 预设响应

### 2. 🚀 生产模式（真实 Claude - 环境变量）
```bash
export ANTHROPIC_API_KEY=your-key
./run-claude.sh
```
- ✅ 真实 AI 响应
- ✅ 不需要配置文件
- ✅ 适合 CI/CD
- ⚠️ 需要 API 密钥

### 3. 🔧 生产模式（真实 Claude - .env 文件）
```bash
# 配置 .env 后
./start-with-claude.sh
```
- ✅ 真实 AI 响应
- ✅ 配置持久化
- ✅ 适合本地开发
- ⚠️ 需要 API 密钥

## 环境变量说明

| 变量 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `ANTHROPIC_API_KEY` | 是* | - | Anthropic API 密钥 |
| `USE_REAL_CLAUDE` | 否 | false | 是否使用真实 Claude |
| `CLAUDE_MODE` | 否 | api | 模式：api 或 cli |
| `CLAUDE_MODEL` | 否 | claude-3-sonnet-20240229 | 模型选择 |

*仅在 USE_REAL_CLAUDE=true 时必需

## 获取 API 密钥

1. 访问 https://console.anthropic.com
2. 创建账号或登录
3. 生成 API 密钥
4. 复制密钥（格式：`sk-ant-...`）

## 一行命令启动

```bash
# 最简单的方式
ANTHROPIC_API_KEY=your-key USE_REAL_CLAUDE=true node super.js
```

## 常见问题

### Q: 必须使用 .env 文件吗？
**A: 不需要！** 直接设置环境变量即可：
```bash
export ANTHROPIC_API_KEY=your-key
./run-claude.sh
```

### Q: 如何在 CI/CD 中使用？
**A:** 在 CI/CD 环境变量中设置：
```yaml
env:
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  USE_REAL_CLAUDE: true
```

### Q: 如何切换模型？
**A:** 设置 CLAUDE_MODEL 环境变量：
```bash
export CLAUDE_MODEL=claude-3-opus-20240229  # 使用 Opus
export CLAUDE_MODEL=claude-3-haiku-20240307  # 使用 Haiku
```

### Q: 密钥安全吗？
**A:** 
- ✅ 环境变量不会被提交到 git
- ✅ .env 文件已在 .gitignore 中
- ⚠️ 永远不要硬编码密钥
- ⚠️ 不要分享你的密钥

## 推荐实践

### 开发时
```bash
# 使用模拟器快速测试
node super.js
```

### 测试真实 Claude 时
```bash
# 临时设置，用完即走
export ANTHROPIC_API_KEY=your-key
./run-claude.sh
```

### 长期本地使用
```bash
# 在 ~/.bashrc 或 ~/.zshrc 中添加
export ANTHROPIC_API_KEY=your-key

# 然后直接运行
./run-claude.sh
```

## 成本控制

- **Haiku**: 最便宜，适合简单任务
- **Sonnet**: 平衡性价比（默认）
- **Opus**: 最强但最贵

估算成本：
- 每 1000 个 token ≈ 750 个单词
- Sonnet: ~$0.003 / 1K tokens (输入)
- 一次典型对话: ~$0.01-0.05

---

💡 **提示**: 开发测试用模拟器，生产环境用真实 Claude！