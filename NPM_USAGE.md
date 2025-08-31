# Supervisor-ME NPM CLI 工具

[![npm version](https://img.shields.io/npm/v/supervisor-me.svg)](https://www.npmjs.com/package/supervisor-me)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

双 Claude 智能验证系统 - 让 Claude Code 编程更可靠

## 🚀 安装

### 全局安装（推荐）
```bash
npm install -g supervisor-me
```

### 项目内安装
```bash
npm install --save-dev supervisor-me
```

### 使用 npx（无需安装）
```bash
npx supervisor-me init
```

## 📋 命令行工具

### `supervisor-me init`
在项目中初始化 Supervisor-ME

```bash
# 基础初始化（智能合并现有配置）
supervisor-me init

# 强制覆盖现有配置
supervisor-me init --force

# 查看帮助
supervisor-me init --help
```

**特性：**
- 🔒 **保护现有 hooks**：不会覆盖用户已有的 hooks 配置
- 📦 **智能合并**：自动合并配置，备份原文件
- 📁 **独立目录**：使用 `lib/supervisor-me/` 和 `logs/supervisor-me/` 避免冲突

### `supervisor-me show-report`
查看验证历史报告（类似 `npx playwright show-report`）

```bash
# 查看最近10条验证记录
supervisor-me show-report

# 查看最近20条记录
supervisor-me show-report -n 20

# 🆕 显示最新的完整验证结果（最全的内容）
supervisor-me show-report --latest

# 🆕 显示详细的验证历史（包含完整内容）
supervisor-me show-report --detailed

# 实时跟踪验证日志
supervisor-me show-report --follow

# 输出JSON格式（便于程序处理）
supervisor-me show-report --json
```

**输出示例：**
```
📋 验证历史报告

────────────────────────────────────────────────────────
🔍 [2024-03-15 10:23:45] Stop hook triggered
🤖 [2024-03-15 10:23:45] 启动 Claude 智能验证 (claude -p 模式)...
📝 验证 Claude 反馈: 验证结果: 通过，功能实现完整，语法正确

🔍 [2024-03-15 10:25:12] Stop hook triggered
📝 验证 Claude 反馈: 验证结果: 失败，测试未通过，建议检查边界条件
────────────────────────────────────────────────────────

💡 提示: 使用 --follow 实时查看 | 使用 --json 输出JSON格式
```

### `supervisor-me status`
查看系统状态

```bash
supervisor-me status
```

**输出示例：**
```
🔍 Supervisor-ME 系统状态

────────────────────────────────────────────────────────
📦 安装状态: ✅ 已安装
⚙️  配置文件: ✅ 存在
🪝 Hooks 脚本: 3 个
   - stop.sh ✅
   - post-tool-use.sh ✅
   - user-prompt-submit.sh ✅
🤖 验证器: ✅ claude-verify-simple.js
📊 验证次数: 42 次
📝 最近验证:
   验证 Claude 反馈: 验证结果: 通过
────────────────────────────────────────────────────────

✨ 系统就绪！启动 Claude Code 即可使用
```

### `supervisor-me test`
测试验证功能

```bash
supervisor-me test
```

创建测试文件并触发验证，验证系统是否正常工作。

### `supervisor-me clean`
清理日志文件

```bash
# 清理30天前的日志
supervisor-me clean

# 清理所有日志
supervisor-me clean --all
```

## 🎯 使用场景

### 场景1：新项目初始化
```bash
cd my-project
npx supervisor-me init
claude  # 启动 Claude Code
```

### 场景2：已有 hooks 的项目
```bash
# Supervisor-ME 会智能合并，不影响现有 hooks
supervisor-me init

# 系统会：
# 1. 备份原配置到 .claude/settings.json.backup.*
# 2. 智能合并 hooks 配置
# 3. 创建独立的 supervisor-stop.sh（如果 Stop hook 已存在）
```

### 场景3：CI/CD 集成
```yaml
# .github/workflows/verify.yml
name: AI Verification
on: [push]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install -g supervisor-me
      - run: supervisor-me init
      - run: supervisor-me test
```

### 场景4：团队协作
```json
// package.json
{
  "scripts": {
    "postinstall": "supervisor-me init",
    "verify:status": "supervisor-me status",
    "verify:report": "supervisor-me show-report",
    "verify:clean": "supervisor-me clean"
  }
}
```

## 🔧 配置说明

### 智能合并规则
1. **新项目**：直接创建完整配置
2. **已有 Stop hook**：创建 `supervisor-stop.sh`，需手动集成
3. **已有其他 hooks**：保留现有，添加缺失的
4. **备份机制**：所有修改前都会备份原文件

### 目录结构
```
your-project/
├── .claude/
│   ├── settings.json         # hooks 配置（智能合并）
│   ├── settings.json.backup.* # 自动备份
│   └── hooks/
│       ├── stop.sh           # 或 supervisor-stop.sh
│       └── ...
├── lib/
│   └── supervisor-me/        # 独立目录，不影响项目
│       ├── claude-verify-simple.js
│       └── ...
└── logs/
    └── supervisor-me/        # 独立日志目录
        └── completions/
            └── stop.log
```

## 📊 报告功能对比

| 功能 | Playwright | Supervisor-ME |
|------|------------|---------------|
| 查看报告 | `npx playwright show-report` | `npx supervisor-me show-report` |
| 实时跟踪 | ❌ | `--follow` |
| JSON输出 | ❌ | `--json` |
| 状态总览 | `show-report` | `status` |
| 日志清理 | 手动 | `clean` 命令 |

## 🚨 注意事项

1. **Hooks 加载时机**：Claude Code 在启动时加载 hooks，修改后需重启
2. **环境变量**：系统使用 `CLAUDE_VERIFIER_MODE=true` 防止验证循环
3. **日志位置**：所有日志在 `logs/supervisor-me/` 目录下
4. **备份文件**：查看 `.claude/settings.json.backup.*` 了解原配置

## 🤝 常见问题

### Q: 会影响我现有的 hooks 吗？
A: 不会。系统会智能合并配置，并备份原文件。

### Q: 如何卸载？
A: 
```bash
# 1. 删除相关文件
rm -rf lib/supervisor-me logs/supervisor-me
# 2. 恢复原配置（如果有备份）
mv .claude/settings.json.backup.* .claude/settings.json
# 3. 卸载 npm 包
npm uninstall -g supervisor-me
```

### Q: 验证会消耗 Claude API 吗？
A: 是的，每次验证会调用一次 Claude API（使用 -p 模式）。

### Q: 可以自定义验证策略吗？
A: 可以编辑 `lib/supervisor-me/claude-verify-simple.js` 中的 `buildPrompt` 方法。

## 📄 许可证

MIT License

## 🔗 相关链接

- [GitHub 仓库](https://github.com/yourusername/supervisor-me)
- [NPM 包页面](https://www.npmjs.com/package/supervisor-me)
- [详细文档](./README.md)
- [使用指南](./USAGE_GUIDE.md)